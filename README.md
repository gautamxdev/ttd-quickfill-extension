# TTD QuickFill

A Chrome extension for user-triggered entry on the official Sri PAT, Special Entry Darshan (SED), and Angapradakshinam pilgrim forms. Version 0.2.0. Select the same number of saved pilgrims as the ticket count, in the same row order, then press **Fill selected pilgrims**. It fills Name, Age, Gender, Photo ID Proof, and Photo ID Number, checks each field, and stops on conflicts. You review the form and press Continue yourself.

## Use

1. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this folder.
2. Open the TTD Sri PAT, SED or Angapradakshinam pilgrim-details page. Select your slot and number of tickets first.
3. Open the extension side panel. Add pilgrims, or import a JSON backup exported from the previous QuickFill. Imported profiles need Age and Gender added in Edit.
4. Check the pilgrims in row order, click **Check form**, then **Fill selected pilgrims**. Review every field on TTD before proceeding.

Profiles use local Chrome storage. The extension does not send data to its own server, submit the form, solve CAPTCHAs, or make payments. It requests Chrome's debugger permission to insert browser input; Chrome shows a prominent permission warning during installation. Host access is limited to `ttdevasthanams.ap.gov.in`.

To update an installation loaded from this same folder, press **Reload** on its card at `chrome://extensions`. Saved profiles are preserved; removing the extension deletes its storage. Chrome may request the new scripting permission. It lets the extension load its form reader in an already-open tab without refreshing your booking page.

## Supported page detection

| Flow | Recognized paths |
| --- | --- |
| Sri PAT | `/spat/pilgrim-details` |
| SED | `/sed/pilgrim-details`, `/sed/slot-booking-acc` |
| Angapradakshinam | `/apd/pilgrim-details` |
| Shared routes | `/pilgrim-details?flow=spat`, `sed` or `apd`; a flow's `/slot-booking?section=pilgrim-details` |

Page detection alone does not start filling. The visible form must contain identifiable pilgrim rows and the selected profile count must match. Native selects and custom dropdowns are handled separately. Additional address, contact, country, visa, document upload or other flow-specific fields must be completed manually. Passport profiles may require those extra details.

## Branding and privacy

This is an independent helper, not affiliated with TTD. The TTD emblem comes from [the portal's image](https://ttdevasthanams.ap.gov.in/ttdlogo.png), remains its owner's property and is used for identification. The toolbar and panel use bundled copies; opening the extension does not fetch remote images.

Profiles are stored locally and are not encrypted by this extension. There is no extension backend or analytics. Do not commit personal profile backups to this repository. Permissions are used for profile storage, the side panel, official-site form inspection, on-demand content script loading, and browser input via the debugger. The debugger detaches after a fill, including on errors.

## Development

`npm test` runs local route, form-mapping and input-flow tests. `npm run check` checks JavaScript syntax. Use Node.js 22 or later. There is no build step or external dependency. The GitHub workflow runs both checks and packages an installable ZIP as an artifact.

The fixture/mock tests are not proof that TTD accepts every input operation. Sri PAT's field layout was inspected on the live portal. SED and Angapradakshinam route handling is implemented, but live end-to-end acceptance on their authenticated booking forms has **not yet been verified**. Verify a dummy entry and review every field before relying on this version for a booking.

If a field is already occupied, the extension stops rather than overwrite it. If a dropdown cannot be identified, it stops and reports the row. The initial installed QuickFill remains a separate extension; its saved profiles stay with its own Chrome extension ID until you export and import them.
