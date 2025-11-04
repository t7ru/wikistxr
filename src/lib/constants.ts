/**
 * Default constants for wikitext highlighting.
 * 
 * Should make as much classes as possible so that users can config through CSS.
 */
export const DEFAULT_URL_PROTOCOLS =
  /^(?:ftp|ftps|git|gopher|http|https|irc|ircs|mms|nntp|redis|sftp|ssh|svn|telnet|worldwind)(?=[^\s\u00a0{[\]<>~).,'])/i;

export const DEFAULT_REDIRECT_KEYWORDS = [
  "REDIRECT",
  "WEITERLEITUNG",
  "REDIRECCIÓN",
  "REDIRECTION",
  "RINVIA",
  "PRZEKIERUJ",
  "REDIRECIONAMENTO",
  "ПЕРЕНАПРАВЛЕНИЕ",
  "重定向",
  "リダイレクト",
  "ĐỔI",
];

export const DEFAULT_EXTENSION_TAGS = [
  "nowiki",
  "pre",
  "ref",
  "references",
  "poem",
  "gallery",
  "tabber",
  "syntaxhighlight",
  "source",
];

export const DEFAULT_CONTENT_PRESERVING_TAGS = [
  "nowiki",
  "pre",
  "syntaxhighlight",
  "source",
  "code",
  "tabber",
];

const COLORS = {
  black: "#000",
  blue: "#0645ad",
  darkBlue: "#3366bb",
  brown: "#a55858",
  darkBrown: "#8b4513",
  purple: "#7f007f",
  green: "#239f00",
  red: "#d33",
  gray: "#72777d",
  darkGray: "#666",
  orange: "#dd7700",
  darkGreen: "#008000",
  mediumBlue: "#0000cd",
  seaGreen: "#2e8b57",
  magenta: "#a020f0",
  lightGrayBg: "rgba(0,0,0,0.04)",
};

const generateSectionStyles = () => {
  const sizes = {
    2: "1.8em",
    3: "1.5em",
    4: "1.3em",
    5: "1.1em",
    6: "1.05em",
  };

  return Object.entries(sizes)
    .map(([level, size]) => `.wt-section-${level} { font-size: ${size}; }`)
    .join("\n  ");
};

const generateExtensionTagStyles = () => {
  return DEFAULT_CONTENT_PRESERVING_TAGS.map(
    (tag) => `.wt-ext-${tag} { background-color: ${COLORS.lightGrayBg}; }`
  ).join("\n  ");
};

export const DEFAULT_STYLES = `
  /* Section headers */
  .wt-section-header { font-weight: bold; color: ${COLORS.black}; }
  ${generateSectionStyles()}

  /* Text formatting */
  .wt-strong { font-weight: bold; }
  .wt-em { font-style: italic; }
  .wt-strong-em { font-weight: bold; font-style: italic; }

  /* Links */
  .wt-link,
  .wt-link-bracket,
  .wt-link-pagename,
  .wt-link-delimiter,
  .wt-link-text { color: ${COLORS.blue}; }
  .wt-link-bracket { font-weight: bold; }

  /* External links */
  .wt-extlink,
  .wt-extlink-bracket,
  .wt-extlink-text,
  .wt-free-extlink { color: ${COLORS.darkBlue}; }

  /* Templates */
  .wt-template,
  .wt-template-bracket,
  .wt-template-name,
  .wt-template-delimiter { color: ${COLORS.brown}; }
  .wt-template-bracket { font-weight: bold; }
  .wt-template-argument-name { color: ${COLORS.darkBrown}; }

  /* Template parameters */
  .wt-templatevariable,
  .wt-templatevariable-bracket,
  .wt-templatevariable-name,
  .wt-templatevariable-delimiter { color: ${COLORS.purple}; }
  .wt-templatevariable-bracket { font-weight: bold; }

  /* Tags */
  .wt-exttag { color: ${COLORS.purple}; }
  ${generateExtensionTagStyles()}
  .wt-htmltag { color: ${COLORS.green}; }

  /* Lists */
  .wt-list { color: ${COLORS.red}; font-weight: bold; }

  /* Comments */
  .wt-comment { color: ${COLORS.gray}; font-style: italic; }

  /* Other */
  .wt-hr { color: ${COLORS.darkGray}; }
  .wt-signature { color: ${COLORS.darkBlue}; }
  .wt-magic-word { color: ${COLORS.magenta}; font-weight: bold; }
  .wt-html-entity { color: ${COLORS.seaGreen}; }
  .wt-redirect { color: ${COLORS.brown}; font-weight: bold; }

  /* Tables */
  .wt-table-bracket,
  .wt-table-delimiter { color: ${COLORS.orange}; font-weight: bold; }
  .wt-table-header { color: ${COLORS.darkGreen}; font-weight: bold; }
  .wt-table-cell { color: ${COLORS.mediumBlue}; }
  .wt-table-attrs { color: ${COLORS.darkGray}; }
`;
