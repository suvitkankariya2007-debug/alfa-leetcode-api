# ChatGPT Plus → Go custom MCP feasibility: verified access verdict
**Checked:** 2026-10-16, using current official OpenAI Help Center and developer documentation  
**Outcome:** **NO-GO for private Plus-created Site-hosted MCP plugin shared directly with a separate personal Go account.**  
**Scope:** access and distribution, not functionality, runtime security, or actual production deployment.

## Confirmed rules

1. **Personal Site-plugin sharing blocked.** OpenAI explicitly says: "Pro and personal-account users can't currently share their Site-hosted plugin directly with other ChatGPT users through invitations or a share link." The Site and its plugin have separate access controls. Source: https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites
2. **Plus can create Sites; Go cannot create Sites.** A Go user may still be an invited viewer or public visitor to a published Site if that Site's access rules permit it. Source: https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites
3. **Site access ≠ in-chat plugin installation.** Even when Go can view the site, the owner's private MCP plugin does not become available in the Go account's ChatGPT chat. Source: https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites
4. **Custom external MCP connection is a separate product entitlement.** The ChatGPT Help Center currently describes full custom MCP connections for Business/Enterprise/Edu workspaces; do not assume direct custom endpoint connections on Plus or Go. Source: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
5. **Plugins directory is cross-plan, but capabilities are conditional.** Go can browse plugins, but an individual plugin or feature can be unavailable due to plan, surface, app approval or other restrictions. On Free/Go, plugin extensions are not available. Sources: https://help.openai.com/en/articles/20001256-plugins-in-chatgpt and https://help.openai.com/en/articles/20001497-troubleshooting-plugins-apps-in-chatgpt
6. **Developer docs describe a 'personal plugin' connection quickstart but do not specify Plus/Go availability.** Treat this as an entitlement/documentation ambiguity rather than proof that Go can independently connect our external MCP. Source: https://developers.openai.com/plugins/quickstart
7. **Public directory publication is a different, more demanding route.** A reviewed public MCP plugin can be distributed via the directory after domain/identity verification, stable public HTTPS server, required documentation and approval. Publication and Go read/write tool eligibility are NOT validated. Do not promise acceptance or a specific rollout. Sources: https://developers.openai.com/plugins/deploy/submission and https://developers.openai.com/plugins/deploy/app-review
8. **Local stdio MCP is desktop-only.** The public submission route for local MCP plugins requires approved partner allowlisting. It is not a solution for cross-account web/mobile access. Source: https://developers.openai.com/plugins/deploy/desktop-only
9. **Sign in with ChatGPT is distinct from custom in-chat MCP.** Go/Plus plan usage in outside applications is documented only for participating apps; this does not automatically enroll our software or share ChatGPT memories. Source: https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites

## Access matrix (supported vs unverified)

| Goal | Plus personal | Separate Go personal | Conclusion |
|---|---|---|---|
| Create ChatGPT Site | Documented yes | Documented no | Plus-owner only |
| Use own Site-hosted plugin in ChatGPT | Documented yes, installation and connection required | Cannot receive it through private personal-account plugin sharing | **Private Plus→Go native tool use blocked** |
| Open permitted published Site | Yes | Possible as authorized viewer or public visitor | Website access, **not an MCP plugin** |
| Independently add same remote custom MCP URL inside ChatGPT | Do not assume eligibility; docs differ | No verified permission/working account test | Unverified, not an implementation dependency |
| Install public reviewed MCP plugin | Conditionally available | Conditionally available; Go features may be restricted | Potential future distribution, **not verified or guaranteed** |
| Run local stdio plugin | Desktop app where supported | Desktop app where supported | Not web/mobile, quota/plan restrictions still apply |
| Preserve common learning state | Requires a backend/internal learner identity | Can access from an authorized Site/web app independently of MCP plugin | Technically feasible via secure backend; NOT live yet |

## Product decision

**Do not build an architecture that presumes Plus can hand off a private Site-hosted MCP plugin to Go.**

For the desired personalized coach across two personal accounts with low cost:
- Keep the learning state server-side, with a single authenticated internal learner ID and explicit account linking.
- Deliver a **web-based coach** accessible to intended Plus and Go users via a permitted Site/web app. This route is client-independent and does not require Go to install a private Plus plugin.
- Offer Plus-specific Site MCP tools as an **optional enhanced interface** only if there is a working test on the Plus account.
- Support generic cross-LLM remote MCP through a stable authenticated HTTPS backend for compatible non-ChatGPT clients.
- Treat future public-directory publication as a separate optional product launch requiring eligibility, review and a live server, not a workaround for private plugin sharing.
- Do not make any claim that a Go user can invoke this private MCP **inside their ChatGPT chat** until demonstrated with real eligible access.

## Pre-code release gate and safe next test

**Gate P0-01: supported account path.** The negative constraint on personal Site-plugin sharing is confirmed by policy; a live two-account test is not necessary to conclude that this private sharing route is unsupported.

For the **website alternative**, the product acceptance test is: Plus owner makes a private Site demo with sample non-sensitive learner data; an authorized Go-account visitor opens the Site; account linking is performed explicitly (not by matching emails or user handles); one sample check-in is saved and later reread; unrelated visitors are denied; no public learner data or secrets are exposed. This test **has not been run** and requires a published Site and explicit user approval.

For a **future Go-native MCP path**, require evidence of a currently supported installation/connection channel, actual read/write tool execution from that Go account, and consent/identity checks; otherwise classify as unavailable.

## Work carried out

Only official documentation was consulted and a decision record created. No account session, plugin, Site, developer submission, cloud resource, authentication provider, database or deployment was created. No application code was changed and no private credentials were requested or accessed.
