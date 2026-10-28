import type { Branch, Flow, Option, QNode, QType } from "./flow";

// Starting point for the brief wizard. Creatives can change all of this in Admin > Brief builder.
// Issue type ids are the real MKTGCRTV ones.

const opts = (...labels: string[]): Option[] => labels.map((label) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), label }));

type Spec = {
  id: string; field?: string; label: string; prompt: string; qtype: QType; next: string | null;
  required?: boolean; help?: string; placeholder?: string; options?: Option[]; branches?: Branch[];
};
const q = (s: Spec): QNode => ({
  id: s.id, field: s.field ?? s.id, label: s.label, prompt: s.prompt, qtype: s.qtype, required: s.required ?? true,
  next: s.next, ...(s.help ? { help: s.help } : {}), ...(s.placeholder ? { placeholder: s.placeholder } : {}),
  ...(s.options ? { options: s.options } : {}), ...(s.branches ? { branches: s.branches } : {}),
});
const when = (field: string, value: string, goto: string): Branch => ({ when: { field, op: "equals", value }, goto });

const TYPES: Option[] = [
  { id: "graphic", label: "Graphic design", jiraIssueTypeId: "18868" },
  { id: "video", label: "Video", jiraIssueTypeId: "18869" },
  { id: "animation", label: "Animation", jiraIssueTypeId: "18870" },
  { id: "web", label: "Web design or UX", jiraIssueTypeId: "18867" },
  { id: "copy", label: "Copywriting", jiraIssueTypeId: "18872" },
  { id: "campaign", label: "A campaign or activation", jiraIssueTypeId: "18866" },
  // There is no "Brand review" issue type in Jira yet, so these land as "Other" with a label that finds them again.
  { id: "brand_review", label: "A brand review", jiraIssueTypeId: "12117", jiraLabel: "brand-review" },
  { id: "idea", label: "I have an idea", jiraIssueTypeId: "18865" },
  { id: "other", label: "Something else", jiraIssueTypeId: "12117" },
];

export const DEFAULT_FLOW: Flow = {
  version: 1,
  start: "type",
  nodes: [
    q({ id: "type", label: "Request type", prompt: "Hi! What kind of help do you need from the Brand Creative team?", qtype: "choice", options: TYPES, next: "title" }),
    q({
      id: "title", label: "Title", prompt: "Great. What should we call it?", help: "A short name people will recognize, like “Q1 webinar banner”.", qtype: "text", next: "o_what",
      branches: [
        when("type", "graphic", "g_use"), when("type", "video", "v_format"), when("type", "animation", "a_what"), when("type", "web", "w_kind"),
        when("type", "copy", "c_kind"), when("type", "campaign", "k_channels"), when("type", "brand_review", "br_what"), when("type", "idea", "i_idea"),
      ],
    }),

    // Graphic design
    q({ id: "g_use", label: "Where it will be used", prompt: "Where will “{{title}}” be used?", qtype: "multichoice", options: opts("Social", "Email", "Web", "Slides", "Print", "Other"), next: "g_size" }),
    q({ id: "g_size", label: "Sizes and specs", prompt: "Any sizes or specs we should hit?", qtype: "longtext", required: false, placeholder: "e.g. 1080×1080 and 1200×628", next: "g_copy" }),
    q({ id: "g_copy", label: "Copy ready", prompt: "Do you already have the copy?", qtype: "yesno", next: "g_assets", branches: [when("g_copy", "no", "g_copyhelp")] }),
    q({ id: "g_copyhelp", label: "Copy help", prompt: "Would you like our team to write it?", help: "We can pair this with a copywriting request.", qtype: "yesno", next: "g_assets" }),
    q({ id: "g_assets", label: "References and assets", prompt: "Share any links to existing assets, brand references or inspiration.", qtype: "longtext", required: false, next: "problem" }),

    // Video
    q({ id: "v_format", label: "Video format", prompt: "What kind of video is it?", qtype: "choice", options: opts("Short social video", "Product explainer", "Customer story", "Event or webinar edit", "Other"), next: "v_len" }),
    q({ id: "v_len", label: "Length", prompt: "About how long should it be?", qtype: "text", required: false, placeholder: "e.g. 30 seconds", next: "v_script" }),
    q({ id: "v_script", label: "Script ready", prompt: "Do you have a script or storyboard?", qtype: "yesno", next: "v_where", branches: [when("v_script", "yes", "v_scriptlink"), when("v_script", "no", "v_scripthelp")] }),
    q({ id: "v_scriptlink", label: "Script link", prompt: "Paste the link to it.", qtype: "link", next: "v_where" }),
    q({ id: "v_scripthelp", label: "Script help", prompt: "Do you need help writing one?", qtype: "yesno", next: "v_where" }),
    q({ id: "v_where", label: "Where it will run", prompt: "Where will people watch it?", qtype: "multichoice", options: opts("Social", "Website", "Email", "Events", "Internal"), next: "v_footage" }),
    q({ id: "v_footage", label: "Footage and assets", prompt: "Any footage, interviews or assets we should use?", qtype: "longtext", required: false, next: "problem" }),

    // Animation
    q({ id: "a_what", label: "What to animate", prompt: "What should we animate?", qtype: "longtext", next: "a_static" }),
    q({ id: "a_static", label: "Static design exists", prompt: "Is there a finished static design to work from?", qtype: "yesno", next: "a_where", branches: [when("a_static", "yes", "a_link")] }),
    q({ id: "a_link", label: "Design link", prompt: "Paste the link to it.", qtype: "link", next: "a_where" }),
    q({ id: "a_where", label: "Where it will live", prompt: "Where will it live?", qtype: "multichoice", options: opts("Website", "Product", "Social", "Presentation"), next: "a_loop" }),
    q({ id: "a_loop", label: "Playback", prompt: "Should it loop?", qtype: "choice", options: opts("Loops", "Plays once", "Not sure"), next: "problem" }),

    // Web design / UX
    q({ id: "w_kind", label: "Web request", prompt: "What are we working on?", qtype: "choice", options: opts("New landing page", "Update an existing page", "Product UI or UX", "Other"), next: "w_figma", branches: [when("w_kind", "update_an_existing_page", "w_url")] }),
    q({ id: "w_url", label: "Current page", prompt: "What's the URL of the page today?", qtype: "link", next: "w_figma" }),
    q({ id: "w_figma", label: "Figma or wireframe", prompt: "Is there a Figma file or wireframe yet?", qtype: "yesno", next: "w_metric", branches: [when("w_figma", "yes", "w_figmalink")] }),
    q({ id: "w_figmalink", label: "Figma link", prompt: "Paste the link.", qtype: "link", next: "w_metric" }),
    q({ id: "w_metric", label: "Number to move", prompt: "What number should this move?", help: "For example sign-ups, click-through or demo requests.", qtype: "text", required: false, next: "problem" }),

    // Copywriting
    q({ id: "c_kind", label: "Kind of copy", prompt: "What do you need written?", qtype: "multichoice", options: opts("Web", "Email", "Ads", "Social", "Press or PR", "Other"), next: "c_length" }),
    q({ id: "c_length", label: "Length", prompt: "About how long?", qtype: "text", required: false, placeholder: "e.g. 3 short paragraphs", next: "c_audience" }),
    q({ id: "c_audience", label: "Audience", prompt: "Who is it for?", qtype: "longtext", next: "c_tone" }),
    q({ id: "c_tone", label: "Tone and examples", prompt: "Any tone guidance or examples you like?", qtype: "longtext", required: false, next: "problem" }),

    // Campaign or activation
    q({ id: "k_channels", label: "Channels", prompt: "Which channels will “{{title}}” run on?", qtype: "multichoice", options: opts("Paid", "Email", "Social", "Web", "PR", "Events"), next: "k_launch" }),
    q({ id: "k_launch", label: "Launch date", prompt: "When does it go live?", qtype: "date", next: "k_goal" }),
    q({ id: "k_goal", label: "Goal", prompt: "What's the goal or key number?", qtype: "text", next: "k_budget" }),
    q({ id: "k_budget", label: "Budget approved", prompt: "Is the budget approved?", qtype: "yesno", next: "k_assets" }),
    q({ id: "k_assets", label: "Assets needed", prompt: "Which assets will you need from us?", qtype: "multichoice", options: opts("Ads", "Landing page", "Email", "Social posts", "Video", "Slides"), next: "problem" }),

    // Brand review: something already made that needs a check that it is on brand (internal assets, swag, gifts and similar).
    q({
      id: "br_what", label: "What's being reviewed", prompt: "What would you like us to review?", qtype: "choice",
      options: opts("Internal document or deck", "Swag or branded item", "Gift or giveaway", "Social post or ad", "Email or web page", "Event materials", "Something else"),
      next: "br_state", branches: [when("br_what", "swag_or_branded_item", "br_swag"), when("br_what", "gift_or_giveaway", "br_swag")],
    }),
    q({ id: "br_swag", label: "Vendor and quantity", prompt: "Who's making it, and how many?", help: "The vendor or printer, the quantity, and whether it's already ordered.", qtype: "longtext", required: false, next: "br_state" }),
    q({ id: "br_state", label: "How far along it is", prompt: "How far along is it?", qtype: "choice", options: opts("Still a draft or concept", "Final, not yet produced or published", "Already produced, printed or live"), next: "br_link" }),
    q({ id: "br_link", label: "Files or photos", prompt: "Share a link to the file, or photos of the item.", help: "Google Drive, Figma, Slides or any link we can open.", qtype: "longtext", next: "br_audience" }),
    q({
      id: "br_audience", label: "Who will see it", prompt: "Will customers or the public see this?", qtype: "choice",
      options: [{ id: "customers", label: "Yes, customers or prospects" }, { id: "public", label: "Yes, partners, press or the public" }, { id: "internal", label: "No, internal only" }],
      next: "br_where", branches: [when("br_audience", "internal", "br_who")],
    }),
    q({ id: "br_where", label: "Where it will appear", prompt: "Where will it be seen, and in which regions?", help: "For example a conference booth in Europe, or the website.", qtype: "text", next: "br_legal" }),
    q({ id: "br_legal", label: "Legal or compliance check", prompt: "Has legal or compliance looked at it?", help: "Claims, partner logos and trademarks usually need a look.", qtype: "yesno", next: "br_focus" }),
    q({ id: "br_who", label: "Who it's for", prompt: "Which team or event is it for?", qtype: "text", required: false, next: "br_focus" }),
    q({ id: "br_focus", label: "What to check", prompt: "Is there anything specific you'd like us to check?", qtype: "multichoice", required: false, options: opts("Logo use", "Colors", "Fonts", "Tone and wording", "Photos and imagery", "Overall look"), next: "deadline" }),

    // Idea
    q({ id: "i_idea", label: "The idea", prompt: "Tell us the idea.", qtype: "longtext", next: "i_why" }),
    q({ id: "i_why", label: "Opportunity", prompt: "Why now? What's the opportunity?", qtype: "longtext", next: "i_who" }),
    q({ id: "i_who", label: "Who benefits", prompt: "Who benefits if we do this?", qtype: "text", required: false, next: "stakeholders" }),

    // Something else
    q({ id: "o_what", label: "What you need", prompt: "Tell us what you need.", qtype: "longtext", next: "problem" }),

    // Shared ending
    q({ id: "problem", label: "Problem statement", prompt: "What problem are we solving?", help: "A sentence or two is plenty.", qtype: "longtext", next: "success" }),
    q({ id: "success", label: "Success measure", prompt: "How will we know it worked?", qtype: "longtext", required: false, next: "facing" }),
    q({ id: "facing", label: "Customer facing", prompt: "Will customers see this?", qtype: "yesno", required: false, next: "deadline" }),
    q({ id: "deadline", label: "Needed by", prompt: "When do you need “{{title}}” by?", qtype: "date", next: "d_firm" }),
    q({ id: "d_firm", label: "Date is firm", prompt: "Is that date firm?", qtype: "yesno", next: "stakeholders", branches: [when("d_firm", "yes", "d_why")] }),
    q({ id: "d_why", label: "What's driving the date", prompt: "What's driving it?", qtype: "text", required: false, next: "stakeholders" }),
    q({ id: "stakeholders", label: "Stakeholders", prompt: "Anyone who should be kept in the loop?", help: "They'll be added as watchers on the ticket.", qtype: "people", required: false, next: "anything" }),
    q({ id: "anything", label: "Anything else", prompt: "Anything else we should know?", qtype: "longtext", required: false, next: null }),
  ],
};
