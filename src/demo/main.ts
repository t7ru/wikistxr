/**
 * Test page for the wikitext highlighter
 */
import { WikitextHighlighter, WikitextEditor } from "wikistxr";

console.log("[Test Page] Initializing...");
const styleElement = document.createElement("style");
styleElement.textContent = WikitextEditor.getDefaultStyles();
document.head.appendChild(styleElement);
const editorHighlighter = new WikitextEditor();
const staticHighlighter = new WikitextHighlighter();
const inputElement = document.getElementById("input") as HTMLTextAreaElement;
const outputElement = document.getElementById("output") as HTMLDivElement;
const statsElement = document.getElementById("stats") as HTMLDivElement;
const modeElement = document.getElementById("mode") as HTMLSelectElement;

const samples = {
  basic: `== Heading ==
'''Bold text''' and ''italic text''
'''''Bold and italic'''''

* List item 1
* List item 2
** Nested item

# Numbered list
# Second item`,

  complex: `{{Tabs}}
{{Victim
| title = Patient Zero
| image = <tabber>
Game = 
|-|Artwork = [[File:Teaser2X.png]]
</tabber>
| description = Example
| health = 85
| stamina = 100
| loss = 2
| regen = 10
| sprint = 24
| walk = 12
| difficulty = 2
}}
{{Quote|ARISE FROM THE DEPTHS|[[Poe]]|ALTER EGO's second teaser|icon=patient zero}}
'''Patient Zero''' is a character in ALTER EGO; his alter is [[Caducus]], the Fallen God.<ref>https://the-official-roblox-scripts-and-exploits.fandom.com/wiki/Caducus</ref>

'''Patient Zero''' was seemingly a guinea pig in the labyrinth, of which he likely awakened his alter ego, [[Caducus]]. His alter shares many similarities with [[Poe]], who presumably was the one experimenting on him.

'''Patient Zero''' is the second missing person.

== Log ==
Once a renowned doctor, '''Patient Zero''' dedicated his life to healing others. He published countless books and received the highest honors in his field. Yet now, he has become a shell of his former self. After the events that scarred him, the constant paranoia and anxiety deprives him of sleep. In the darkness, he swears he could see a smile staring back.

== Appearance ==
'''Patient Zero''' wears a blueish-white shirt featuring the classic Roblox "Spawn" symbol, with blood stained bandages on his right arm; in another depiction, he is shown wearing a white pinstripe suit. 

== Gameplay ==
=== Official ===
{| class="wikitable w-100"
! class="w-5" |Icon
!Ability
!Type
!Description
!Demonstration
|-
|[[File:VitalMins.png|72px|center]]
|Vital-Mins
|Active
|Start regenerating 7 HP / sec for 5 seconds. On damage, healing gets interrupted.
|[[File:VitaMinsUse.gif|150px|center]]
|-
|[[File:Dissociate.png|72px|center]]
|Dissociate
|Active
|The survivor will go invisible for 10 seconds.
|[[File:DissociateUse.gif|150px|center]]
|-
|[[File:Anxiety.png|72px|center]]
|Anxiety
|Passive
|If the killer is near you, the survivor will be alerted of its direction with a screen indicator.
|[[File:AnxietyActive.gif|150px|center]]
|}

=== Detailed ===
{| class="wikitable w-100"
! class="w-5" |Icon
!Ability
!Type
!cooldown
!windup
!Max use
!Description
|-
|[[File:VitalMins.png|72px|center]]
|Vital-Mins
|Active
|45s
|3s
|2x
|Start regenerating 7 HP / sec for 5 seconds. On damage, healing gets interrupted.
|-
|[[File:Dissociate.png|72px|center]]
|Dissociate
|Active
|40s
|~0.1s
|∞
|The survivor will go invisible for 10 seconds.
|-
|[[File:Anxiety.png|72px|center]]
|Anxiety
|Passive
|N/A
|N/A
|N/A
|If the killer is near you, the survivor will be alerted of its direction with a screen indicator.
|}

== Strategy ==
'''Patient Zero''' is a survivalist, providing no help to his teammates, and cannot even body block due to his low health. However, his survivability arguably exceeds every other character. As '''Patient Zero''', you should always be doing your tasks to help your team get out as soon as possible.

===Vital-Mins===
'''Patient Zero's''' self-heal, this move provides a very strong heal, healing almost 45% of Patient Zero's health, but suffers from limited uses and interruption.
*Use this ability mainly at below {{HP|45}}, so you can get the full {{HP|35}} heal.
*Only use this when you are not in chase, as if you use it at the wrong time, you can lose your healing, wasting one of your two uses.

===Dissociate===
'''Patient Zero's''' chase escape move, this move is effective for escaping chases; however can be a gamble if the [[Alter Egos|Ego]] closes the distance.
*Use this to escape sticky situations safely, as it basically guarantees an escape.
**Alternatively, you can use this before a chase even starts, allowing you to make the [[Alter Egos|Ego]] lose sight of you almost instantly.
**You can also use this during a chase when you hit below {{HP|45}}, to use ''Vital-Mins'' afterwards.
*You can try using this move for stalling instead of escaping if you still want to [[Alter Egos|Ego]] to be on you.
*Do not get hit, as it nullifies the invisibility.

===Anxiety===
''Anxiety'' is a useful passive ability to enhance spatial awareness. For example, if the indicator is gone, ''Vital-Mins'' should be safe to use. Otherwise, if it is there, it likely means that [[Alter Egos|Ego]] is about to chase you, so then you can ''Dissociate'' and avoid being chased entirely.

== Trivia ==
*'''Patient Zero''' was one of the original five teased [[victims]], along with [[B-Man]], [[Commander]], [[Fjord]] and [[Toothy]].<ref>https://x.com/play_alterego/status/1916635035538538745</ref>
*'''Patient Zero's''' design appears to have changed slightly during development.
**In the first teaser for the game's characters, '''Patient Zero''' appears to have pale skin rather than white, and a black button on his shirt.
***Color-picking the skin gives a grayish-yellow color, with no yellow lighting on the art.
*'''Patient Zero''' seems to heavily diverge from ''Tower Defense Simulator's'' [[w:c:tds:Patient Zero|Patient Zero]].{{cn}}

== Update Log ==
{{Scroll|content=
*2025/10/24 - [[Alpha 0.5.8]]
**Health increased from {{HP|80}} to {{HP|85}}.
*2025/10/09 - [[Alpha 0.1]]
**Health reduced from {{HP|100}} to {{HP|80}}.
**Stamina Recovery increased from {{STA|10}} per second to {{STA|20}} per second.
**Walk Speed increased from 12 studs per second to 14 studs per second.
**Sprint Speed increased from 12 studs per second to 14 studs per second.
**Difficulty increased from 1 to 2.
**Dissociate's invisibility reduced from 15 seconds to 10 seconds.
**Updated log.
*Before 2025/10/14 - [[Pre-Alpha]]
**'''Patient Zero''' added.
}}

== References ==
<references/>


{{CharacterNav}}`,

  links: `[[Internal Link]]
[[Article|Display Text]]
[[File:Example.png|thumb|Caption]]
[https://example.com External Link]
[https://example.com Example Site]
https://example.com`,

  templates: `{{Template}}
{{Template|param1|param2}}
{{Template|name=value|name2=value2}}
{{{Parameter}}}
{{{Parameter|default value}}}`,

  tables: `{| class="wikitable"
! Header 1 !! Header 2 !! Header 3
|-
| Cell 1 || Cell 2 || Cell 3
|-
| Cell 4 || Cell 5 || Cell 6
|}`,

  tags: `<nowiki>'''Not bold'''</nowiki>

<pre>
Preformatted text
  with indentation
</pre>

<ref>Reference content</ref>

<!-- HTML comment -->`,
};

let currentMode: "editor" | "highlighter" = "editor";

function highlightText() {
  const input = inputElement.value;
  const startTime = performance.now();

  try {
    if (currentMode === "highlighter") {
      outputElement.innerHTML = staticHighlighter.highlight(input);
      const endTime = performance.now();
      const totalTime = (endTime - startTime) / 1000;
      const lines = input.split("\n").length;
      const chars = input.length;
      statsElement.textContent = `✓ Highlighted ${lines} lines, ${chars} characters in ${totalTime.toFixed(
        3,
      )}s`;
      console.log(
        `[Test Page] [Highlighter] Highlighting complete in ${totalTime.toFixed(3)}s`,
      );
    }
  } catch (error) {
    console.error("[Test Page] Error:", error);
    const message = `Error: ${(error as Error).message}`;
    outputElement.innerHTML = `<span style="color: red;">${message}</span>`;
    if (currentMode === "highlighter") {
      statsElement.textContent = `[Highlighter] ✗ ${message}`;
    }
  }
}

function setMode(mode: "editor" | "highlighter") {
  if (mode === currentMode) return;
  currentMode = mode;

  const inputPanel = document.querySelector(
    ".panel:first-child",
  ) as HTMLElement;

  if (mode === "editor") {
    document.body.classList.add("editor-mode");
    if (inputPanel) inputPanel.style.display = "none";
    statsElement.innerHTML = '✗ <strong>Editor mode is experimental.</strong> Use "Highlighter" mode for stable and reliable production use cases.';

    outputElement.contentEditable = "true";
    editorHighlighter.resetCache();
    editorHighlighter.attach(outputElement);
    editorHighlighter.update(inputElement.value || samples.basic);
  } else {
    document.body.classList.remove("editor-mode");
    if (inputPanel) inputPanel.style.display = "block";

    outputElement.contentEditable = "false";
    editorHighlighter.resetCache();
    highlightText();
  }
}

if (inputElement && outputElement && statsElement && modeElement) {
  inputElement.addEventListener("input", () => {
    highlightText();
  });

  modeElement.addEventListener("change", () =>
    setMode(modeElement.value === "editor" ? "editor" : "highlighter"),
  );

  document.getElementById("btn-basic")?.addEventListener("click", () => {
    const text = samples.basic;
    if (currentMode === "editor") {
      editorHighlighter.update(text);
    } else {
      inputElement.value = text;
      highlightText();
    }
  });

  document.getElementById("btn-complex")?.addEventListener("click", () => {
    const text = samples.complex;
    if (currentMode === "editor") {
      editorHighlighter.update(text);
    } else {
      inputElement.value = text;
      highlightText();
    }
  });

  document.getElementById("btn-links")?.addEventListener("click", () => {
    const text = samples.links;
    if (currentMode === "editor") {
      editorHighlighter.update(text);
    } else {
      inputElement.value = text;
      highlightText();
    }
  });

  document.getElementById("btn-templates")?.addEventListener("click", () => {
    const text = samples.templates;
    if (currentMode === "editor") {
      editorHighlighter.update(text);
    } else {
      inputElement.value = text;
      highlightText();
    }
  });

  document.getElementById("btn-tables")?.addEventListener("click", () => {
    const text = samples.tables;
    if (currentMode === "editor") {
      editorHighlighter.update(text);
    } else {
      inputElement.value = text;
      highlightText();
    }
  });

  document.getElementById("btn-tags")?.addEventListener("click", () => {
    const text = samples.tags;
    if (currentMode === "editor") {
      editorHighlighter.update(text);
    } else {
      inputElement.value = text;
      highlightText();
    }
  });

  document.getElementById("btn-clear")?.addEventListener("click", () => {
    if (currentMode === "editor") {
      editorHighlighter.update("");
    } else {
      inputElement.value = "";
      highlightText();
    }
  });

  inputElement.value = samples.basic;
  modeElement.value = "highlighter";
  setMode("highlighter");
  console.log("[Test Page] Ready");
}
