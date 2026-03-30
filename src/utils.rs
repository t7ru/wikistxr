/// UTF-16 code-unit length of `s`
///
/// Fast paths pure ASCII input (shoooould covers ~99% of wikitext) to avoid the char
/// iterator entirely, whatever other cases goes to the fold for multi-byte characters.
#[inline(always)]
pub(crate) fn u16len(s: &str) -> u32 {
    if s.is_ascii() {
        return s.len() as u32;
    }
    s.chars().fold(0u32, |n, c| n + c.len_utf16() as u32)
}

/// Balanced-delimiter scan
///
/// Returns byte length of the full `open...close` block,
/// or 0 if the input ends before the delimiters balance.
pub(crate) fn find_closing(s: &[u8], open: &[u8], close: &[u8]) -> usize {
    let (ol, cl) = (open.len(), close.len());
    let mut depth = 1usize;
    let mut j = ol;
    while j + cl <= s.len() {
        if s[j..].starts_with(close) {
            depth -= 1;
            if depth == 0 {
                return j + cl;
            }
            j += cl;
        } else if s[j..].starts_with(open) {
            depth += 1;
            j += ol;
        } else {
            j += 1;
        }
    }
    0
}

// Hot path lookup table

/// Lookup table for fast path byte matching
///
/// One array index replaces 8 match arms inside position() on every loop iteration.
/// `|` and `!` are intentionally excluded as they are only special inside
/// table rows and are handled by the inline condition in the fast-path closure.
const fn make_special_table() -> [bool; 256] {
    let mut t = [false; 256];
    let mut i = 0usize;
    let bytes = b"<[{}&'~_";
    while i < bytes.len() {
        t[bytes[i] as usize] = true;
        i += 1;
    }
    t
}
pub(crate) static SPECIAL_BYTE: [bool; 256] = make_special_table();
