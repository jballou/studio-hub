/** "jira" turns on Atlassian sign-in and real Jira data; anything else keeps the mock demo. */
export const isJira = process.env.NEXT_PUBLIC_DATA_SOURCE === "jira";
