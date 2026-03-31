use regex::Regex;
use wasm_bindgen::prelude::*;

use crate::utils::{SPECIAL_BYTE, find_closing, u16len};

// Class IDs
pub const CLS_TEXT: u32 = 0;
pub const CLS_COMMENT: u32 = 1;
// 2-6 = wt-section-header wt-section-{level}
pub const CLS_REDIRECT: u32 = 7;
pub const CLS_LIST: u32 = 8;
pub const CLS_HR: u32 = 9;
pub const CLS_TBL_BRACKET: u32 = 10;
pub const CLS_TBL_ATTRS: u32 = 11;
pub const CLS_TBL_DELIM: u32 = 12;
pub const CLS_TBL_CELL: u32 = 13;
pub const CLS_TBL_HDR: u32 = 14;
pub const CLS_TMPL_BRACKET: u32 = 15;
pub const CLS_TMPL_TEXT: u32 = 16;
#[expect(
    dead_code,
    reason = "discrete TPBR/TPNAME/TPDEL/TPVAL tokens are emitted instead"
)]
pub const CLS_TMPL_VAR: u32 = 17;
pub const CLS_TPBR: u32 = 18;
pub const CLS_TPNAME: u32 = 19;
pub const CLS_TPDEL: u32 = 20;
pub const CLS_TPVAL: u32 = 21;
#[expect(
    dead_code,
    reason = "discrete LINK_BR/LINK_PAGE/LINK_PIPE/LINK_LABEL tokens are emitted instead"
)]
pub const CLS_LINK_FULL: u32 = 22;
pub const CLS_LINK_BR: u32 = 23;
pub const CLS_LINK_PAGE: u32 = 24;
pub const CLS_LINK_PIPE: u32 = 25;
pub const CLS_LINK_LABEL: u32 = 26;
#[expect(
    dead_code,
    reason = "discrete ELINK_BR/ELINK_URL tokens are emitted instead"
)]
pub const CLS_ELINK_FULL: u32 = 27;
pub const CLS_ELINK_BR: u32 = 28;
#[expect(dead_code, reason = "protocol is folded into CLS_ELINK_URL")]
pub const CLS_ELINK_PROTO: u32 = 29;
pub const CLS_ELINK_URL: u32 = 30;
#[expect(
    dead_code,
    reason = "label emitted as CLS_TEXT to match old parseExternalLink"
)]
pub const CLS_ELINK_LABEL: u32 = 31;
pub const CLS_FREE_URL: u32 = 32;
pub const CLS_HTML_TAG: u32 = 33;
pub const CLS_EXT_TAG: u32 = 34;
pub const CLS_EXT_CONTENT: u32 = 35;
pub const CLS_STRONG_EM: u32 = 36;
pub const CLS_STRONG: u32 = 37;
pub const CLS_EM: u32 = 38;
pub const CLS_ENTITY: u32 = 39;
pub const CLS_SIG: u32 = 40;
pub const CLS_MAGIC: u32 = 41;

// State bit layout
// bit 0: in HTML comment
// bits 1-6: ctag_idx, 1-based, 0 = none
// bits 7-12: template depth, 0-63
const S_CMT: u32 = 1;
const S_CTAG_SH: u32 = 1;
const S_CTAG_M: u32 = 0x3F << 1;
const S_TDEP_SH: u32 = 7;
const S_TDEP_M: u32 = 0x3F << 7;

// Tokenizer

#[wasm_bindgen]
pub struct WikitextTokenizer {
    url_re: Regex,
    redirect_re: Regex,
    ext_tags: Vec<String>,
    content_tags: Vec<String>,
}

#[wasm_bindgen]
impl WikitextTokenizer {
    #[wasm_bindgen(constructor)]
    pub fn new(url_protocols: &str, redirect_kw: &str, ext_tags: &str, content_tags: &str) -> Self {
        let url_re = Regex::new(&format!("(?i-u)^(?:{url_protocols})")) // unicode-case never
            .unwrap_or_else(|_| Regex::new("a^").unwrap());

        let safe_redirects = redirect_kw
            .split('|')
            .map(regex::escape)
            .collect::<Vec<_>>()
            .join("|");

        let redirect_re = Regex::new(&format!("(?i-u)^#\\s*(?:{})\\s*", safe_redirects))
            .unwrap_or_else(|_| Regex::new("a^").unwrap());

        let csv = |s: &str| -> Vec<String> {
            s.split(',')
                .filter(|t| !t.is_empty())
                .map(str::to_string)
                .collect()
        };

        Self {
            url_re,
            redirect_re,
            ext_tags: csv(ext_tags),
            content_tags: csv(content_tags),
        }
    }

    /// Tokenize one line of wikitext
    ///
    /// Returns `[state_out, start₁, end₁, cls₁, ...]` where offsets are UTF-16 units.
    /// Pass `state_out` back as `state` on the next line.
    pub fn tokenize_line(&self, line: &str, mut state: u32, is_first: bool) -> Vec<u32> {
        let bytes = line.as_bytes();
        let mut out = Vec::with_capacity(1 + (line.len().min(512) / 6 + 4) * 3);
        out.push(0u32);

        let mut i = 0usize;
        let mut u = 0u32;

        macro_rules! emit {
            ($s:expr, $e:expr, $c:expr) => {
                out.extend_from_slice(&[$s, $e, $c])
            };
        }

        // Content preserving tag conti
        {
            let ci = ((state & S_CTAG_M) >> S_CTAG_SH) as usize;
            if ci > 0 {
                let tag = &self.content_tags[ci - 1];
                let mut found_pos = None;
                let mut offset = 0;
                while let Some(p) = line[offset..].find("</") {
                    let abs_p = offset + p;
                    let after = &line[abs_p + 2..];
                    if after.starts_with(tag.as_str()) && after[tag.len()..].starts_with('>') {
                        found_pos = Some(abs_p);
                        break;
                    }
                    offset = abs_p + 2;
                }
                if let Some(pos) = found_pos {
                    if pos > 0 {
                        emit!(0, u16len(&line[..pos]), CLS_EXT_CONTENT);
                    }
                    let su = u16len(&line[..pos]);
                    let close_len = 3 + tag.len() as u32; // "</" + tag + ">"
                    let eu = su + close_len;
                    emit!(su, eu, CLS_EXT_TAG);
                    i = pos + close_len as usize;
                    u = eu;
                    state &= !S_CTAG_M;
                } else {
                    emit!(0, u16len(line), CLS_EXT_CONTENT);
                    out[0] = state;
                    return out;
                }
            }
        }

        // HTML comment conti
        if (state & S_CMT) != 0 {
            if let Some(p) = line[i..].find("-->") {
                let end_i = i + p + 3;
                let eu = u + u16len(&line[i..end_i]);
                emit!(u, eu, CLS_COMMENT);
                i = end_i;
                u = eu;
                state &= !S_CMT;
            } else {
                emit!(u, u + u16len(&line[i..]), CLS_COMMENT);
                out[0] = state;
                return out;
            }
        }

        // First line redirect
        if is_first {
            if let Some(m) = self.redirect_re.find(line) {
                let eu = u16len(&line[..m.end()]);
                emit!(0, eu, CLS_REDIRECT);
                i = m.end();
                u = eu;
            }
        }

        // Pos 0 only line level syntax
        let tdepth = (state & S_TDEP_M) >> S_TDEP_SH;

        if i == 0 {
            // Section headers ^(={2,6})content\1\s*$
            if bytes.first() == Some(&b'=') {
                let eq = bytes.iter().take_while(|&&b| b == b'=').count();
                if eq >= 2 {
                    let level = eq.min(6);
                    let trimmed = line.trim_end();
                    let trail = trimmed.bytes().rev().take_while(|&b| b == b'=').count();
                    if trail >= eq && trimmed.len() > eq * 2 {
                        emit!(0, u16len(line), level as u32);
                        out[0] = state;
                        return out;
                    }
                }
            }

            // Hr ----+
            if bytes.len() >= 4 && bytes.iter().all(|&b| b == b'-') {
                emit!(0, bytes.len() as u32, CLS_HR); // all ASCII
                out[0] = state;
                return out;
            }

            // List markers [*#:;]+  (all ASCII -> len == u16len)
            let ll = bytes
                .iter()
                .take_while(|&&b| matches!(b, b'*' | b'#' | b':' | b';'))
                .count();
            if ll > 0 {
                emit!(0, ll as u32, CLS_LIST);
                i = ll;
                u = ll as u32;
            }

            // Table control {| |} |-
            if i == 0 && tdepth == 0 {
                if bytes.starts_with(b"{|") || bytes.starts_with(b"|}") || bytes.starts_with(b"|-")
                {
                    let cls = if bytes.starts_with(b"|-") {
                        CLS_TBL_DELIM
                    } else {
                        CLS_TBL_BRACKET
                    };
                    emit!(0, 2, cls); // 2 ASCII bytes
                    let rest = &line[2..];
                    if let Some(ns) = rest.find(|c: char| !c.is_ascii_whitespace()) {
                        if ns > 0 {
                            emit!(2, 2 + ns as u32, CLS_TEXT);
                        }
                        let ao = 2 + ns as u32;
                        emit!(ao, ao + u16len(&rest[ns..]), CLS_TBL_ATTRS);
                    }
                    out[0] = state;
                    return out;
                }
            }
        }

        // Table row opening | !
        let in_trow = i == 0 && tdepth == 0 && matches!(bytes.first(), Some(&b'|') | Some(&b'!'));
        if in_trow {
            let hdr = bytes[0] == b'!';
            emit!(0, 1, if hdr { CLS_TBL_HDR } else { CLS_TBL_CELL }); // 1 ASCII byte
            i = 1;
            u = 1;
            let rest = &line[i..];
            if let Some(pipe) = rest.find('|') {
                let pre = &rest[..pipe];
                if pre.contains('=') || pre.contains('"') {
                    let pu = u16len(pre);
                    emit!(u, u + pu, CLS_TBL_ATTRS);
                    u += pu;
                    i += pipe;
                    emit!(u, u + 1, CLS_TBL_DELIM); // 1 ASCII byte
                    u += 1;
                    i += 1;
                }
            }
        }

        // Main scan loop
        while i < line.len() {
            let rem = &line[i..];
            let rb = &bytes[i..];
            let tdepth = (state & S_TDEP_M) >> S_TDEP_SH;
            let text_cls = if tdepth > 0 { CLS_TMPL_TEXT } else { CLS_TEXT };

            if rb.first().map(|b| b.is_ascii_alphabetic()).unwrap_or(false)
                && self.url_re.is_match(rem)
            {
                let raw_end = rem
                    .find(|c: char| {
                        c.is_whitespace() || matches!(c, '\u{00a0}' | '{' | '[' | '<' | '>' | '~')
                    })
                    .unwrap_or(rem.len());

                let mut ue = raw_end;
                while ue > 0 && matches!(rb[ue - 1], b')' | b'.' | b',' | b'\'') {
                    ue -= 1;
                }

                if ue > 0 {
                    let eu = u + u16len(&rem[..ue]);
                    emit!(u, eu, CLS_FREE_URL);
                    u = eu;
                    i += ue;
                    continue;
                }
            }

            // bs goes here don't worry about it
            let sp = rb.iter().position(|&b| {
                SPECIAL_BYTE[b as usize] || (in_trow && tdepth == 0 && matches!(b, b'|' | b'!'))
            });
            match sp {
                None => {
                    emit!(u, u + u16len(rem), text_cls);
                    break;
                }
                Some(0) => { /* weeeeeeeee */ }
                Some(n) => {
                    let pu = u16len(&rem[..n]);
                    emit!(u, u + pu, text_cls);
                    u += pu;
                    i += n;
                    continue;
                }
            }

            // Pattern dispatch

            // HTML comment  <!--...-->
            if rb.starts_with(b"<!--") {
                if let Some(p) = rem.find("-->") {
                    let bl = p + 3;
                    let eu = u + u16len(&rem[..bl]);
                    emit!(u, eu, CLS_COMMENT);
                    u = eu;
                    i += bl;
                } else {
                    emit!(u, u + u16len(rem), CLS_COMMENT);
                    state |= S_CMT;
                    break;
                }
                continue;
            }

            // Table row delimiters mid row (all ASCII -> +1)
            if in_trow && tdepth == 0 {
                if rb[0] == b'|' && !rb.starts_with(b"|-|") {
                    emit!(u, u + 1, CLS_TBL_DELIM);
                    u += 1;
                    i += 1;
                    continue;
                }
                if rb[0] == b'!' {
                    emit!(u, u + 1, CLS_TBL_HDR);
                    u += 1;
                    i += 1;
                    continue;
                }
            }

            // Template param {{{...}}}
            if rb.starts_with(b"{{{") {
                let bl = find_closing(rb, b"{{{", b"}}}");
                let has_close = bl > 0;
                let content_end = if has_close { i + bl - 3 } else { line.len() };

                emit!(u, u + 3, CLS_TPBR); // 3 ASCII bytes
                u += 3;
                i += 3;
                let rest = &line[i..content_end];
                let np = rest
                    .find(|c: char| c == '|' || c == '}')
                    .unwrap_or(rest.len());
                if np > 0 {
                    let nu = u16len(&rest[..np]);
                    emit!(u, u + nu, CLS_TPNAME);
                    u += nu;
                    i += np;
                }
                while i < content_end && bytes[i] == b'|' {
                    emit!(u, u + 1, CLS_TPDEL); // 1 ASCII byte
                    u += 1;
                    i += 1;
                    let rest2 = &line[i..content_end];
                    let vp = rest2
                        .find(|c: char| c == '|' || c == '}')
                        .unwrap_or(rest2.len());
                    if vp > 0 {
                        let vu = u16len(&rest2[..vp]);
                        emit!(u, u + vu, CLS_TPVAL);
                        u += vu;
                        i += vp;
                    }
                }
                if has_close {
                    emit!(u, u + 3, CLS_TPBR); // 3 ASCII bytes
                    u += 3;
                    i += 3;
                }
                continue;
            }

            // Template open {{
            if rb.starts_with(b"{{") {
                emit!(u, u + 2, CLS_TMPL_BRACKET); // 2 ASCII bytes
                u += 2;
                i += 2;
                state = (state & !S_TDEP_M) | ((tdepth + 1).min(63) << S_TDEP_SH);
                continue;
            }

            // Template close }}
            if rb.starts_with(b"}}") {
                emit!(u, u + 2, CLS_TMPL_BRACKET); // 2 ASCII bytes
                u += 2;
                i += 2;
                state = (state & !S_TDEP_M) | (tdepth.saturating_sub(1) << S_TDEP_SH);
                continue;
            }

            // Internal link [[...]]
            if rb.starts_with(b"[[") {
                let bl = find_closing(rb, b"[[", b"]]");
                let has_close = bl > 0;
                let content_end = if has_close {
                    i + bl - 2
                } else {
                    i + 2
                        + rb[2..]
                            .iter()
                            .position(|&b| matches!(b, b'}' | b']' | b'{' | b'['))
                            .unwrap_or(rb.len() - 2)
                };

                emit!(u, u + 2, CLS_LINK_BR); // 2 ASCII bytes
                u += 2;
                i += 2;
                let rest = &line[i..content_end];
                let pp = rest.find('|').unwrap_or(rest.len());
                if pp > 0 {
                    let pu = u16len(&rest[..pp]);
                    emit!(u, u + pu, CLS_LINK_PAGE);
                    u += pu;
                    i += pp;
                }
                while i < content_end && bytes[i] == b'|' {
                    emit!(u, u + 1, CLS_LINK_PIPE); // 1 ASCII byte
                    u += 1;
                    i += 1;
                    let rest2 = &line[i..content_end];
                    let lp = rest2.find('|').unwrap_or(rest2.len());
                    if lp > 0 {
                        let lu = u16len(&rest2[..lp]);
                        emit!(u, u + lu, CLS_LINK_LABEL);
                        u += lu;
                        i += lp;
                    }
                }
                if has_close {
                    emit!(u, u + 2, CLS_LINK_BR); // 2 ASCII bytes
                    u += 2;
                    i += 2;
                }
                continue;
            }

            // External link [url label]
            if rb[0] == b'[' && rb.len() > 1 && self.url_re.is_match(&rem[1..]) {
                emit!(u, u + 1, CLS_ELINK_BR); // 1 ASCII byte
                u += 1;
                i += 1;
                let rest = &line[i..];
                let url_end = rest
                    .find(|c: char| c.is_ascii_whitespace() || c == ']')
                    .unwrap_or(rest.len());
                if url_end > 0 {
                    let uu = u16len(&rest[..url_end]);
                    emit!(u, u + uu, CLS_ELINK_URL);
                    u += uu;
                    i += url_end;
                }
                if i < line.len() && bytes[i] == b' ' {
                    let rest2 = &line[i..];
                    let lp = rest2.find(']').unwrap_or(rest2.len());
                    let lu = u16len(&rest2[..lp]);
                    emit!(u, u + lu, CLS_TEXT);
                    u += lu;
                    i += lp;
                }
                if i < line.len() && bytes[i] == b']' {
                    emit!(u, u + 1, CLS_ELINK_BR); // 1 ASCII byte
                    u += 1;
                    i += 1;
                }
                continue;
            }

            // Extension tag  <name ...>  or  </name>
            if rb[0] == b'<' {
                if let Some(gt_rel) = rem[1..].find('>') {
                    let full_bl = gt_rel + 2;
                    let is_close = rb.get(1) == Some(&b'/');
                    let name_start = if is_close { 2usize } else { 1 };
                    let name_len = rem[name_start..]
                        .find(|c: char| !c.is_ascii_alphanumeric() && c != '-')
                        .unwrap_or(full_bl.saturating_sub(name_start));
                    let tag_name = &rem[name_start..name_start + name_len];

                    let is_self_closing = rem[..full_bl].ends_with("/>");
                    if !is_close
                        && !is_self_closing
                        && self.content_tags.iter().any(|t| t == tag_name)
                    {
                        let mut cp_opt = None;
                        let mut offset = full_bl;
                        while let Some(p) = rem[offset..].find("</") {
                            let abs_p = offset + p;
                            let after = &rem[abs_p + 2..];
                            if after.starts_with(tag_name)
                                && after[tag_name.len()..].starts_with('>')
                            {
                                cp_opt = Some(abs_p);
                                break;
                            }
                            offset = abs_p + 2;
                        }
                        if let Some(cp_abs) = cp_opt {
                            let bl = cp_abs + 3 + tag_name.len(); // tag_name is ASCII
                            let eu = u + u16len(&rem[..bl]);
                            emit!(u, eu, CLS_EXT_TAG);
                            u = eu;
                            i += bl;
                        } else {
                            let ci = self
                                .content_tags
                                .iter()
                                .position(|t| t == tag_name)
                                .unwrap()
                                + 1;
                            state = (state & !S_CTAG_M) | ((ci as u32) << S_CTAG_SH);
                            emit!(u, u + u16len(rem), CLS_EXT_CONTENT);
                            break;
                        }
                        continue;
                    }

                    let tag_cls = if self.ext_tags.iter().any(|t| t == tag_name) {
                        CLS_EXT_TAG
                    } else {
                        CLS_HTML_TAG
                    };
                    let eu = u + u16len(&rem[..full_bl]);
                    emit!(u, eu, tag_cls);
                    u = eu;
                    i += full_bl;
                    continue;
                }
                // No > on this line would mean to single char text
            }

            // HTML entity &name; &#123; &#xAB;
            if rb[0] == b'&'
                && let Some(sc) = rem[1..].find(';')
                && let inner = &rem[1..sc + 1]
                && !inner.is_empty()
                && (inner.bytes().all(|b| b.is_ascii_alphabetic())
                    || (inner.starts_with('#') && inner[1..].bytes().all(|b| b.is_ascii_digit()))
                    || (inner.starts_with("#x")
                        && inner[2..].bytes().all(|b| b.is_ascii_hexdigit())))
            {
                let bl = sc + 2; // &...; is all ASCII
                emit!(u, u + bl as u32, CLS_ENTITY);
                u += bl as u32;
                i += bl;
                continue;
            }

            // Bold + italic  '''''...'''''
            if rb.starts_with(b"'''''") {
                if let Some(c) = rem[5..].find("'''''") {
                    let bl = c + 10; // all ASCII
                    emit!(u, u + bl as u32, CLS_STRONG_EM);
                    u += bl as u32;
                    i += bl;
                    continue;
                }
            }
            // Bold  '''...'''
            if rb.starts_with(b"'''") {
                if let Some(c) = rem[3..].find("'''") {
                    let bl = c + 6; // all ASCII
                    emit!(u, u + bl as u32, CLS_STRONG);
                    u += bl as u32;
                    i += bl;
                    continue;
                }
            }
            // Italic  ''...''
            if rb.starts_with(b"''") {
                if let Some(c) = rem[2..].find("''") {
                    let bl = c + 4; // all ASCII
                    emit!(u, u + bl as u32, CLS_EM);
                    u += bl as u32;
                    i += bl;
                    continue;
                }
            }

            // Signature  ~~~  ~~~~  ~~~~~  (all ASCII -> count == u16len)
            if rb.starts_with(b"~~~") {
                let n = rb.iter().take(5).take_while(|&&b| b == b'~').count();
                emit!(u, u + n as u32, CLS_SIG);
                u += n as u32;
                i += n;
                continue;
            }

            // Magic word  __UPPERCASEWORD__
            // let-chains collapse three levels of nesting into one condition.
            if rb.starts_with(b"__")
                && rem.len() > 4
                && let Some(ep) = rem[2..].find("__")
                && let word = &rem[2..ep + 2]
                && !word.is_empty()
                && word.bytes().all(|b| b.is_ascii_uppercase())
            {
                let bl = ep + 4; // all ASCII
                emit!(u, u + bl as u32, CLS_MAGIC);
                u += bl as u32;
                i += bl;
                continue;
            }

            let ch = rem.chars().next().unwrap();
            let cu = ch.len_utf16() as u32;
            emit!(u, u + cu, text_cls);
            u += cu;
            i += ch.len_utf8();
        }

        out[0] = state;
        out
    }
}
