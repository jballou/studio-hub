// The terms staff accept before downloading National 2. Bump FONT_LICENSE_VERSION whenever the wording changes:
// the version is recorded with each acceptance, so the record shows exactly which terms someone agreed to.
export const FONT_LICENSE_VERSION = "2026-11";

export type LicenseSection = { n: number; title: string; body: string[] };

export const FONT_LICENSE = {
  title: "National 2 Font License Terms",
  subtitle: "Internal use by SurveyMonkey personnel",
  intro:
    "SurveyMonkey (the “Company”) has licensed the National 2 typeface family and its font software (the “Font Software”) from its licensor. This license is why you may use the font at work. Please read these terms before you download.",
  sections: [
    {
      n: 1,
      title: "Grant of permission",
      body: [
        "As a current employee or authorized contractor of the Company, you may install and use the Font Software on Company-managed or Company-approved devices, solely to create materials for the Company’s business (the “Approved Purposes”).",
        "This permission is limited, non-exclusive, non-transferable and revocable. It is not a sale, and you receive no ownership of the Font Software.",
      ],
    },
    {
      n: 2,
      title: "What you may not do",
      body: [
        "You may not share, send, lend, sell, sublicense or otherwise distribute the Font Software, or any part of it, to anyone, including colleagues who have not accepted these terms, friends, family, vendors and agencies, unless the Company has approved it in writing.",
        "You may not upload, copy or store the Font Software on any server, website, cloud service, code repository, design or AI tool, or personal device or account that the Company has not approved.",
        "You may not modify, convert, extract, decompile or create derivative fonts from the Font Software, or use it for personal projects or for anyone other than the Company.",
      ],
    },
    {
      n: 3,
      title: "Finished work is fine",
      body: [
        "Documents, images, videos, PDFs and printed materials you create with the Font Software for the Approved Purposes may be shared as usual. These terms restrict the font files themselves, not the work you make with them.",
      ],
    },
    {
      n: 4,
      title: "Web and app use is a separate request",
      body: [
        "This permission covers installed, desktop use only. If you need a web-hosted version of the font, for example for a website, an app, an email or a landing page, do not host or embed the files yourself. Submit a separate request to the Brand Creative team so the correct license and hosting can be arranged.",
      ],
    },
    {
      n: 5,
      title: "Ownership",
      body: ["The Font Software is the property of its licensor and is protected by copyright and other laws. All rights not expressly granted here are reserved."],
    },
    {
      n: 6,
      title: "Ending this permission",
      body: [
        "Your permission ends when your employment or engagement with the Company ends, or sooner if the Company revokes it. When it ends, you must stop using the Font Software and delete every copy you hold.",
      ],
    },
    {
      n: 7,
      title: "Records and compliance",
      body: [
        "The Company records your acceptance, including your name, work email, the date and time, and the version of these terms, and may review use of the Font Software to confirm it follows the license. Breach of these terms may lead to loss of access and action under Company policy.",
      ],
    },
    {
      n: 8,
      title: "No warranty",
      body: ["The Font Software is provided “as is”, without warranties of any kind, to the extent the law allows."],
    },
  ] as LicenseSection[],
  agreement:
    "I have read and agree to these terms. I understand that I may use National 2 only for the Company’s approved purposes, that I may not share it or upload it to unapproved servers, and that web-hosted use needs a separate request.",
};
