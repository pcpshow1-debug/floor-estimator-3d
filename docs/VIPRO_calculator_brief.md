# VIPRO flooring calculator: implementation prompt

Use this brief to improve the separate VIPRO flooring calculator. The marketing website is a separate workstream. Work only in the calculator project supplied by the owner. Do not change or deploy the marketing website, overwrite another developer’s work, contact customers, or publish production changes without the owner’s authorization.

Your role: senior product engineer with strong residential-flooring UX judgment. Produce a practical, attractive estimator that reflects Vlad’s preferences and asks questions a flooring contractor can actually use. Optimize for a short, credible homeowner experience, not a giant questionnaire, a flashy demo, or a falsely precise quote.

## 1. Read these evidence labels first

- **CONFIRMED:** explicit feedback from Vlad or the project owner. Preserve these requirements.
- **REFERENCE:** an observed competitor interaction or a public product fact. It informs the design but does not establish VIPRO’s inventory, prices, methods, or business policies.
- **RECOMMENDATION:** engineering or flooring-workflow guidance proposed for this calculator. It is not a statement that Vlad already does or charges for it.
- **OPEN:** a missing business decision. Keep it configurable or disabled until confirmed. Never fill it with an invented fact.

Vlad’s voice feedback was reviewed through the complete Telegram-generated transcripts of three recordings, not independently checked against the original audio. Do not turn an uncertain transcript detail into an exact contractual promise.

## 2. Confirmed client requirements

1. **Ask the project intent before the room type.** Vlad disliked clicking “Get your price” and immediately seeing “Living room / Kitchen.” First distinguish restoring/refinishing an existing floor from replacing/installing a floor.
2. **Give refinishing its own focused journey.** It should not feel like a generic material-shopping calculator. Replacement can have a fuller selection flow.
3. **Include a useful finish explorer:** Bona sealers and DuraSeal stains, with color selection and an approximate estimate when supported by approved prices. Vlad mentioned area adjustment with a slider.
4. **Do not force a room-type choice before finish browsing.** A visitor should be able to explore colors directly.
5. **Use smaller, more refined controls.** Vlad suggested compact choices, potentially in two rows, for laminate, LVP, hardwood, and stairs. This is a layout preference, not a requirement to model stairs as a flooring material.
6. **Realistic visual quality matters.** The current laminate/tile visualization looked crude or unclear. Either fully polish an interaction or remove it. His principle was “лучше меньше но четко”: fewer features, properly finished.
7. **White or black foundation.** Vlad explicitly preferred a white or black background. The project owner reinforced a minimal black-and-white direction and rejected generic alternative designs. Avoid brown/beige-heavy UI and unrequested green branding. Natural wood colors belong in the photography and samples.
8. **Follow the actual references.** David’s Flooring is the explicit overall-design reference; OC Flooring is the concrete finish-explorer reference; EP Master is a realistic-visualization quality reference.
9. **Use truthful content.** Vlad plans to supply real work photos and process information. His dust-control text is pending a shorter version. Do not invent performance claims, dust-free guarantees, project counts, credentials, testimonials, or “no subcontractors” promises.

## 3. References and important limits

### Design: David’s Flooring

https://www.davidsflooring.com/

Use its clarity, bold heading hierarchy, generous spacing, restrained controls, and large photographic treatment as reference. Translate those qualities into a usable calculator; do not paste a marketing homepage into every step. Do not copy its branding, claims, review counts, or image assets without rights.

### Finish explorer: OC Flooring

https://www.nwocflooring.com/

The supplied reference showed a large realistic room, separate “SEALER FINISH” and “STAIN COLOR” tabs, product name, tone description, compact swatches, Living/Kitchen and Room/Plank preview switches, and a warm-to-light/cool browsing slider.

Five Bona labels visible in the reference were Amber, Intense, Classic, Natural, and Nordic. This is not an approved VIPRO product list. The DuraSeal reference screenshot showed 21 swatches; Vlad spoke approximately of 30-plus colors. Do not hardcode either count.

Public catalog checks found DuraSeal Quick Coat listing 36 packaged colors plus intermix possibilities, and Bona’s US catalog showing NordicSeal, NaturalSeal, ClearSeal, IntenseSeal, and AmberSeal. The Classic/Clear discrepancy must be confirmed with Vlad. Do not silently substitute products, invent mixed colors, or expose every manufacturer product as something VIPRO offers.

Official verification sources:
- https://www.duraseal.com/product/quick-coat-2-hour-penetrating-finish/
- https://www.duraseal.com/stain-gallery/
- https://www.bona.com/en-us/professional/wood-flooring-contractor/finishes
- https://www.bona.com/en-us/professional/faqs

### Visualization quality: EP Master

https://epmasterconstruction.com/

Vlad liked a screenshot of its polished deck configurator. Treat this as a quality bar for realistic materials, light, and compact controls. It does not require a 3D engine, a deck estimator, or a clone of its interface. The separate deck app was not reviewed.

### Existing VIPRO preview

https://vipro-preview.vercel.app/

Use it to understand existing branding and entry points, not as an authoritative rate card or approved specification. Earlier site content includes provisional material and sample reviews. Existing published prices, claims, and services need provenance before reuse. Do not assume its technology or data contracts are the same as those of the separate calculator repository.

## 4. Start with a focused audit [RECOMMENDATION]

Inspect the actual calculator repository, its instructions, package manager, available components, pricing code, image assets, persistence, integrations, and tests. Identify what already works before proposing a rewrite. Follow the existing stack unless there is a concrete reason to change it. Read relevant repository instructions and skills.

Return a compact gap list against the confirmed requirements. Distinguish broken behavior from a proposed enhancement. Preserve unrelated work and existing customer data. Do not recover missing source by reconstructing an entire application from screenshots.

If no repository is supplied, produce the screen plan, data contracts, and missing-input list. Do not claim that implementation, testing, or deployment has happened.

Everything below is a proposed technical design. Business rules, rates, availability, warranties, timing, and claims remain OPEN until supported by the owner’s materials.

## 5. Recommended homeowner journeys

### Entry

Lead with “What would you like to do?”
- “Refinish my existing wood floors.”
- “Install or replace flooring.”
- A secondary “I’m not sure” route that collects a short description and can request an assessment.

Provide an “Explore floor colors” entry that does not require area, contact details, or a room selection. Preserve selected products when the visitor later starts an estimate.

If someone arrives from a dedicated refinishing page, preselect that service and show an editable “Refinishing” label rather than forcing a redundant intent step. Direct calculator visits must still start with intent.

### Refinishing

Suggested sequence: existing floor and condition → area → finish look → relevant extras → estimate and optional contact.

- Ask whether the existing floor is solid hardwood, engineered wood, another material, or unknown. Ask wood species only when useful and allow “Not sure.”
- Distinguish full sanding/refinishing, a possible maintenance recoat, and repair work. Recoating is conditional, not automatically suitable or cheaper for every floor.
- Only offer a separately priced recoat service if Vlad confirms he offers it and approves its eligibility questions. Otherwise collect the concern for review.
- Engineered wood requires confirmation of remaining wear-layer suitability. A homeowner’s answer or photo must not guarantee that sanding is safe.
- Do not offer hardwood sanding for laminate, LVP, or tile. Explain the mismatch and let the visitor change the service or request advice without losing useful input.
- Use plain-language condition questions: general wear, deep scratches, dark stains/pet damage, water damage, gaps, loose/damaged boards, or unknown. Photos are optional.
- Unknown coating, wax/oil contamination, severe staining, moisture damage, or extensive repairs should create review flags, not a confident automatic repair price.
- Let visitors choose a natural/sealer-led look or a stain color, then an available finish system and sheen only when approved. “Natural” must not imply leaving the floor unprotected.

Do not require the customer to know sanding grits, technical adhesion details, coat counts, moisture thresholds, or chemical compatibility. Those belong in the contractor configuration and site assessment.

### Installation/replacement

Suggested sequence: flooring choice → area → existing floor and preparation → relevant extras → estimate and optional contact.

- Start with compact photographic choices for the confirmed material categories: hardwood, LVP, and laminate. Expose tile only when its service scope and assets are confirmed; Vlad’s criticism of a tile preview is not by itself an approved tile catalog.
- Separate “Install flooring” from “Replace existing flooring” so removal and disposal are not assumed on new/empty substrates.
- Distinguish customer-supplied material, contractor-supplied material, and undecided. Keep labor-only and labor-plus-material estimates explicit.
- For hardwood, model prefinished versus unfinished only when offered. Unfinished installation may require an approved finishing package; do not add a second full refinishing labor charge by accident.
- Ask only relevant preparation questions: existing floor type, known layers, subfloor type if known, obvious unevenness or moisture issues, and occupied/furnished status.
- Glue-down, nail-down, and floating are technical methods, not freely interchangeable upgrades. Offer only valid, approved product/subfloor combinations and allow “To be confirmed.”
- Pattern installation, herringbone/parquet, borders, wide-plank specifications, radiant heat, unusual transitions, or major subfloor correction can be review-only unless priced and supported.

### Stairs and mixed projects

- Keep stairs discoverable as Vlad requested, but model them as their own scope: refinish existing stairs or install/replace stair components.
- Capture tread count, whether risers and nosings are included, and separate landing area when relevant. Railings, balusters, stringers, and unusual geometry are separate scope, not automatically included.
- A landing cannot be billed once as floor area and again as a stair bundle.
- Support “Add another area/service” only after the single-service flow works. Each scope keeps its own selections. Mixed jobs must not apply one finish or material choice to every area by accident.

## 6. Area and quantity handling [RECOMMENDATION]

- Offer a direct total-area input first. Add optional room-by-room dimensions for visitors who need help.
- Use square feet by default for the intended US audience, subject to owner confirmation. If metric is offered, convert through one canonical unit with tested precision.
- Synchronize the numeric area input and slider. The slider is a convenience, not the only control. Its convenience range must not silently cap or truncate a larger valid typed value.
- Do not present a prefilled demonstration area as the customer’s measurement. Any demo state must be visibly labeled and separate from a real estimate.
- Support feet/inches without ambiguous decimal-foot interpretation. Validate negative, zero, nonfinite, unrealistic, and malformed inputs.
- Show which rooms, closets, hallways, landings, and exclusions contribute to the total. Provide overlap safeguards and editable labels.
- Store net measured work area separately from material purchasing quantity. Apply an approved waste allowance to appropriate materials only. Do not increase refinishing labor area simply because material waste exists.
- Do not infer accurate square footage, wear-layer thickness, damage depth, or moisture from a single photo.
- Ask optional room type only when it changes a supported rule or a preview. A Living/Kitchen preview switch is not a measurement input and must not change the estimate on its own.

## 7. Finish catalog and compatibility [RECOMMENDATION]

Separate these concepts in both the data model and UI:

1. Existing wood species/substrate.
2. Color treatment: stain or an approved sealer-led look.
3. Sealer product, where the approved system uses one.
4. Protective finish/topcoat system.
5. Sheen, such as an approved matte/satin/gloss choice.

Stain, sealer, and topcoat are not synonyms. A browsing interface may present stain and sealer as alternative ways to explore color, while some approved systems contain both. Encode the actual product system rather than a simplistic universal “stain XOR sealer” rule. Do not assume that mixing manufacturers is valid or invalid without product instructions and Vlad’s approval.

Recommended catalog fields: stable ID, manufacturer, full product name, product code when available, category, exact swatch label, wood-species context, tone tags, approved preview assets, compatible system IDs, supported sheen IDs, price-rule ID or null, availability status, verification date, source, and approval status.

- Never use an array index or display name as the durable product ID.
- No product count in marketing copy unless derived from the active approved catalog.
- Do not invent a different price for every swatch. A color changes the total only through a specific approved pricing rule.
- Sheen changes visual appearance but does not automatically change labor or material cost.
- If an archived product is restored from a saved estimate, show that it needs review. Do not silently replace it with a similar product.
- Tone sorting is a browse/filter feature. A warm/cool slider must select or filter discrete real products, not generate fictional intermediate DuraSeal or Bona products.
- Include a short disclaimer: appearance varies with wood species, existing condition, lighting, application, and screen. A physical sample on the actual floor is the reliable approval step.

## 8. Visualization quality gate [RECOMMENDATION]

Make a small number of excellent previews before expanding the catalog.

- Prefer approved product photography, licensed sample-room imagery, or carefully prepared consistent renders. Record asset provenance and usage rights.
- Keep camera, room, wood species, board scale, grain direction, lighting, shadows, and perspective consistent when comparing colors.
- Room/Plank views must clearly describe what they show. Never imply that a wood stain preview is an installation material preview.
- Generic inspirational images must not be labeled as actual VIPRO projects or exact manufacturer samples.
- A CSS tint over a room photo is not adequate evidence of material realism. If precise previews are unavailable, use an honest labeled sample and a polished static room image, or hide the unsupported interactive view.
- Do not show a false before/after comparison using unrelated rooms or misaligned floor geometry.
- Selecting a product must always produce the correct label, swatch, and preview, including during rapid changes and slow loads. Cancel or ignore stale asynchronous results.
- Preload the next useful asset, not every full-resolution image. Use responsive images, loading placeholders, and an accessible fallback when an asset fails.
- Real-time 3D and “try it on my photo” are optional later features, not MVP requirements. If photo visualization is offered, make floor masking, perspective, edge quality, and an explicit illustrative-result disclaimer pass review first.
- Never use generative-image output to measure a floor or diagnose whether it can be sanded.

## 9. Pricing engine: no invented rates [RECOMMENDATION]

**No approved VIPRO rate card is available in this brief. Do not manufacture prices, import competitor prices, or assume prices already on the preview site are approved.**

Build the structure to accept a versioned owner-approved rate card. Missing data is null/unknown, never zero. Development fixtures may contain obviously synthetic values for tests, isolated from production and prominently labeled as test data.

Recommended pricing dimensions:
- service and material/product scope;
- quantity unit: square foot, linear foot, each, or fixed project fee;
- labor versus supplied material;
- removal, disposal, preparation, repair, trim/transition work, furniture movement, stairs, and other approved extras;
- project/service minimums and their precise applicability;
- approved region/travel/access rules;
- tax treatment and jurisdiction;
- effective date, approval/provenance, and rate-card version.

Do not expose every possible extra to every customer. These are configurable categories, not confirmed VIPRO charges.

Calculation rules:
1. Derive canonical quantities from validated customer inputs.
2. Resolve compatible service/product rules and prerequisite selections.
3. Build itemized priced lines and separately list unresolved scope.
4. Apply only approved package inclusions, exclusions, minimums, modifiers, discounts, and taxes in a documented order.
5. Recalculate server-side on submission. Never trust a client-provided total or arbitrary price-rule ID.
6. Store money in integer minor units or a decimal-safe money type, with documented rounding. Use an appropriate decimal quantity representation for area.

Prevent double counting: bundled preparation versus separate preparation; stair landings versus room area; included sealer versus separate sealer; unfinished-install finishing versus a second refinishing charge; disposal bundled with removal; project minimum charged once versus repeated per room.

A minimum adjustment should be a visible line with an explanation, if the approved rate card uses one. Do not silently enforce a guessed minimum or round up to an invented package.

Use ranges only when the approved rules supply bounds or uncertainty allowances. Do not create a range by attaching an arbitrary ± percentage. For a known lower bound and unresolved upper scope, say what is priced and what still needs review instead of fabricating a maximum.

If tax cannot be reliably determined, explicitly show that it is not yet calculated and identify whether the displayed amount is before tax. Do not infer an exact tax jurisdiction from a city label or ZIP alone where that is insufficient. Do not collect a full address merely to show an initial budget unless the business flow needs it.

Recommended estimate states:
- `complete_estimate`: all scope needed for the displayed estimate has approved price rules; still subject to on-site confirmation.
- `partial_estimate`: a clearly named subtotal or range for priced scope, with separate unpriced items. Never label this subtotal “Total project price.”
- `assessment_required`: relevant scope cannot be safely or credibly auto-priced.
- `pricing_unavailable`: required rate-card data is absent or invalid.

The UI must never show $0, NaN, an unbounded range, or a fabricated price when configuration is missing.

## 10. Contractor-specific scope and safety [RECOMMENDATION]

Capture important site conditions without turning the calculator into professional diagnosis.

- Optional questions can cover pets/occupancy, furniture, appliances, access/stairs/elevator, parking, HOA/condo working restrictions, trim/doors, and a preferred time frame, where relevant.
- Distinguish furniture movement from appliance, plumbing, gas, or electrical disconnection. Do not imply every service includes those tasks.
- Do not promise that sanding removes every pet stain, scratch, or water mark. Board repair or replacement may be needed after assessment.
- Unknown legacy flooring/adhesives, suspected hazardous material, active leaks, or major structural damage require professional review. Do not advise customers to sand, cut, scrape, or disturb suspicious material to answer a question.
- Do not promise “100% dust-free,” “zero odor,” immediate occupancy, safe exposure for particular health conditions, or exact cure times. Use only approved product-specific instructions and restrained, substantiated copy.
- Distinguish dry-to-touch, walk-on, furniture return, and full cure if timing guidance is later added. Do not turn a manufacturer product name containing a time into a project-completion promise.
- Moisture testing, acclimation, substrate tolerances, sanding sequence, coat schedule, ventilation, and compatible finish systems must come from the actual products and contractor process. Unknown values stay unknown.
- Scheduling preferences are not confirmed bookings. Do not claim a date, turnaround, warranty, price validity period, or deposit policy that the owner has not supplied.

## 11. Estimate summary and useful contractor output [RECOMMENDATION]

Show the customer a readable result before requesting unnecessary personal information.

Include:
- service(s), material responsibility, net work area and stair quantities;
- selected product names and sheen, with illustrative-preview label where relevant;
- itemized labor/material/extras when priced and supported;
- subtotal, applicable adjustments, tax status, and final amount/range only when valid;
- explicit inclusions, exclusions, unknowns, and site-review flags;
- “Preliminary estimate, subject to measurement and site inspection” wording;
- edit links back to each relevant selection;
- a clear “Request an on-site quote” or equivalent approved contact action.

For Vlad, create a structured estimate record containing the same snapshot, customer-entered notes, approved attachments if any, unresolved questions, rate-card/catalog version, timestamp, and an internal estimate ID. Make it useful for follow-up without forcing him to reconstruct choices from analytics events.

Offer a printable/downloadable summary if it fits the existing app. PDF/export numbers must be generated from the same estimate snapshot as the screen, not independently recalculated by a second formula.

Do not imply that requesting an estimate signs a contract, places an order, pays a deposit, or confirms an appointment. Payment, financing, e-signing, and automatic booking are outside the MVP unless separately requested.

## 12. UX, mobile, and accessibility [RECOMMENDATION]

- Customer-facing language: clear US English, pending confirmation of additional languages.
- Keep the main path short. Use conditional questions and optional detail sections rather than displaying all technical fields at once.
- Compact controls must still have usable touch targets. Aim for approximately 44 px interactive targets, with clear focus and selected states.
- On mobile, consider two-column material cards and a compact summary that does not cover fields or error messages. Swatches may wrap or scroll but cannot be tiny unlabeled dots.
- Show step progress, Back, and a reliable edit path. Preserve valid answers during navigation.
- If changing service invalidates later selections, explain the specific fields being reset. Keep independent area/contact data where appropriate.
- Distinguish “unknown,” “not selected,” and “not applicable.” Avoid forced guesses.
- Keyboard-operable tabs, sliders, cards, dialogs, and image comparisons; semantic labels; WCAG 2.2 AA contrast; descriptive alternative text; reduced-motion support.
- Do not rely only on color for selection. Announce updated estimates accessibly without noisy announcements on every slider movement.
- Loading, empty, offline, error, unavailable-product, and submission-success states must be designed rather than left as browser alerts.
- Avoid a compulsory login or contact gate just to explore finishes or see a legitimately available budget estimate.

## 13. Suggested architecture and contracts [RECOMMENDATION]

Use the existing project stack. Prefer typed domain models and a pure deterministic pricing function over calculations embedded in UI components. Suggested conceptual modules: catalog, compatibility, measurement normalization, pricing rules, estimate validation, visual assets, draft persistence, and lead submission.

Suggested domain entities:
- `ProjectDraft`: schema version, service scopes, measurement inputs, selections, optional non-sensitive context.
- `Scope`: intent, existing substrate/material, requested service, area/quantity references, material supplier responsibility, extras, condition flags.
- `CatalogProduct` and `FinishSystem`: approved products, assets, compatibility and available options.
- `RateCard`: version, effective date, approval status, rates, packages, tax/modifier/minimum rules.
- `EstimateSnapshot`: immutable validated inputs, quantities, line items, unresolved scope, currency, tax status, estimate status, catalog/rate-card versions, timestamp.
- `LeadRequest`: snapshot reference, user-provided contact details, requested response method, explicitly submitted notes/uploads, submission status.

Share a narrow versioned handoff contract with the marketing-website owner. Example non-personal fields are service intent, product ID, display unit, optional area, and source page. A website link may preselect a value, but the calculator must validate it against its own catalog and schema.

Do not guess a calculator domain, endpoint, phone number, webhook, or CRM destination. Verify the actual owner-controlled destinations. Reject arbitrary external redirect targets. Never put contact details, home photos, or private estimate data in a URL query string.

Persist only minimal non-sensitive draft selections locally when appropriate; version the draft and offer a clear reset. Do not assume browser storage is permanent or available. Expired catalog/rate-card versions must trigger revalidation with a visible notice if totals change.

## 14. Submission, security, privacy, and reliability [RECOMMENDATION]

- Browsing and estimating must not silently send a sales lead. Submit customer information only through a clear, deliberate form action that names the recipient business and purpose.
- Collect the minimum contact details needed. Keep marketing consent separate, optional, and unchecked; do not automatically subscribe people.
- Show the actual privacy notice. Set retention/deletion behavior from an owner-approved policy rather than inventing a legal promise.
- Protect server-side keys and rate-card editing. Use server validation, strict schemas, sensible input limits, safe output rendering, and abuse/rate limiting suited to the stack.
- No customer contact details, addresses, notes, or photos in analytics payloads, routine logs, public storage, or publicly accessible estimate links.
- Photo uploads are optional and need explicit action. Validate type/size, sanitize/re-encode where appropriate, remove unnecessary EXIF location metadata, use private storage and scoped access, and provide deletion/retention handling.
- Do not send home photos to an external AI renderer without a clear disclosure of the provider and purpose and an appropriate user choice. Do not use photos for unrelated training or marketing.
- Prevent duplicate leads with idempotent submission, a pending state, and explicit retry behavior. A network timeout is not proof the submission failed; check the request status before resending.
- Show success only after server confirmation. If delivery to a CRM/email provider is delayed or fails, retain a safe recoverable record and report the real state rather than claiming that Vlad received it.
- Any estimate-sharing link must use appropriate access controls and avoid exposing customer details by default. A secret URL is not a substitute for authorization where personal information requires protection.
- Optional analytics should measure drop-off, completion, missing-price rules, preview failures, and contact conversion without personal content or covert session replay.

## 15. Quality assurance and acceptance criteria [RECOMMENDATION]

Write automated tests around measurement, compatibility, and pricing independently of the UI. Add end-to-end tests for the main journeys and important interruptions.

Required scenarios:
1. A direct visitor sees project intent before room type.
2. A refinishing deep link preserves the preselection and allows changing it.
3. Finish browsing works without contact details or room selection.
4. Bona and DuraSeal choices preserve exact approved IDs and labels; no fabricated products or counts appear.
5. Stain/sealer/topcoat/sheens obey approved compatibility, including invalid and unknown cases.
6. Laminate/LVP cannot receive a hardwood-sanding estimate; unknown engineered-floor suitability routes to assessment.
7. Slider, direct area entry, room dimensions, feet/inches, and optional metric conversion remain consistent.
8. Empty, zero, negative, very large, nonnumeric, and decimal inputs produce clear validation without corrupting a draft.
9. Waste affects only the intended quantity; rooms/landings/stairs are not double-counted.
10. Bundles, minimums, per-unit fees, tax, rounding, and mixed scopes produce reproducible line items.
11. Missing prices produce unavailable/partial/assessment states, never $0 or a fake total.
12. Material color or preview-room changes cannot modify price without a valid explicit rule.
13. Back/Forward, refresh, service switching, saved drafts, and obsolete products/rates behave predictably.
14. Rapid preview changes, missing assets, slow responses, and renderer failure never show a mismatched product or stale price.
15. Double-click, timeout, refresh-after-submit, and retry cannot create duplicate leads or false success.
16. Server totals cannot be changed by tampering with browser values; uploaded files and customer data remain private.
17. Print/download, contractor record, and screen all use the same estimate snapshot.
18. Keyboard-only use, screen-reader labels, contrast, reduced motion, narrow phone screens, and a real or emulated mobile Safari flow are checked.
19. No dead buttons, placeholder reviews, unsupported promises, or unfinished visualizations remain in the release scope.

For pricing tests, synthetic fixtures are acceptable only in test environments and must never appear as live VIPRO rates. Report which checks passed, failed, or were not run. Do not call screenshots “tested functionality.”

## 16. Delivery plan and open questions

Recommended order:
1. Audit the supplied calculator and map confirmed requirements.
2. Present the two core flows and a small number of reference-faithful desktop/mobile screens.
3. Build the approved catalog/measurement/pricing structure with honest unavailable states.
4. Complete a polished refinishing path and installation path with only supported services.
5. Connect the verified lead destination and add consistent estimate output.
6. Test, provide a preview for review, and list remaining business approvals. Production publication is a separate explicit action.

Keep complex 3D, photo-based AI visualization, full scheduling, payments, financing, and a large admin portal out of the first release unless explicitly needed. A secure validated configuration file may be enough for the first rate card; an admin UI should solve a real update need.

Ask the owner only for information not present in the supplied project. Bundle the business questions:
- Which services and material categories does Vlad actually offer, including recoat, tile, parquet, stairs, repairs, and unusual patterns?
- Which exact Bona and DuraSeal products, color codes, finish systems, and sheen options are active? What does “Classic” mean in his assortment?
- What are the approved labor/material rates, packages, minimums, extras, tax rules, and estimate wording?
- Which preparation/process steps and product-specific timing statements may be published?
- Which photographs and swatches are authorized for use, and which show actual VIPRO work?
- What is the confirmed service area, branding/contact identity, lead destination, and privacy/retention policy?
- What repository, preview environment, and website-to-calculator handoff already exist?

Continue safe independent engineering work while those business inputs are pending. Do not stall the whole project over a missing price, but do not publish a fabricated one.

Final handoff must include: implemented scope, screen/preview link if created, changed files, data model and configuration instructions, pricing assumptions and unresolved fields, verified test results, integration contract, and any blocked action. Be explicit about what is still a proposal rather than Vlad’s confirmed practice.

**Success means a homeowner can choose the right service, understand a realistic finish choice, enter useful quantities, and receive an honest preliminary estimate or an equally clear assessment request. Vlad receives a usable project brief. The calculator looks polished and makes no claims the business has not approved.**
