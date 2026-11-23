export type InsightGuide = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  updatedAt: string;
  readingMinutes: number;
  intro: string;
  serviceIds: string[];
  sections: Array<{
    heading: string;
    paragraphs: string[];
    checklist?: string[];
    sourceIds?: string[];
  }>;
  sources: Array<{ id: string; label: string; url: string }>;
};

// Original public planning guides. Dates change only after a substantive review.
// Source links support the relevant section; they do not imply vendor endorsement.
export const insightGuides: InsightGuide[] = [
  {
    slug: 'microsoft-365-security-checklist-egypt',
    title: 'A Microsoft 365 security checklist for SMEs in Egypt',
    summary: 'A practical review of accounts, business email, shared files and devices, with a clear owner and evidence for every improvement.',
    category: 'Microsoft 365 & Cloud',
    updatedAt: '2026-11-23',
    readingMinutes: 4,
    intro: 'A small business needs email, customer files and staff access to keep working through everyday changes. Use this checklist to turn a Microsoft 365 security review into a manageable work plan. It is written for SMEs operating in Egypt, including teams with remote colleagues and international suppliers. Adapt the operational checks to your services and organisational requirements.',
    serviceIds: ['microsoft-365'],
    sections: [
      {
        heading: '1. Establish what you actually manage',
        paragraphs: [
          'Record the tenant, business domains, subscription plans, active staff and administrator accounts. Microsoft 365 security capabilities differ by licence: Business Premium includes additional identity, device and email protection. Check your assigned subscriptions before promising a control that is unavailable in the tenant.',
          'Choose one accountable person for each area and a safe change window. Keep the review record in a restricted location, with an agreed date for the next check.'
        ],
        checklist: ['List business systems that send email using your domain.', 'Record who can approve access and security changes.'],
        sourceIds: ['microsoft-security-overview']
      },
      {
        heading: '2. Verify sign-in protection and administrator access',
        paragraphs: [
          'Check which accounts are covered by multifactor authentication rather than assuming a prompt proves everyone is protected. Microsoft recommends security defaults or Conditional Access for Microsoft 365 MFA. Security defaults is available with Entra ID Free; Conditional Access requires an appropriate premium licence.',
          'Use separate administrator and everyday accounts. Before changing authentication settings, identify older mail clients, scanners and applications that may depend on unsupported sign-in methods. Pilot the change with a small group, document account recovery and confirm that critical business workflows still work.'
        ],
        sourceIds: ['microsoft-mfa', 'microsoft-security-defaults']
      },
      {
        heading: '3. Check the domain behind your business email',
        paragraphs: [
          'Inventory all legitimate senders, including invoice software, a CRM and website notifications. Follow Microsoft’s domain-specific instructions for SPF, DKIM and DMARC; copy the records supplied for your own configuration, not values from another company’s example.',
          'Test representative messages from every authorised sender before tightening enforcement. Record the result, responsible administrator and rollback decision. Review email protection policies against the capabilities you actually license, and give staff a simple route for reporting suspicious messages.'
        ],
        sourceIds: ['microsoft-email-deployment']
      },
      {
        heading: '4. Review shared files and working devices',
        paragraphs: [
          'SharePoint applies external-sharing settings at organisation and site level, with the more restrictive setting taking effect. Separate confidential internal material from customer collaboration areas. Give each shared site an owner who can confirm which guests still need access after a project ends.',
          'Maintain a device list covering office laptops and approved remote-working equipment. Check updates, device protection and the process for a lost device. Where your licence includes management tools, confirm that devices are enrolled and reporting; purchasing a subscription alone does not demonstrate deployment.'
        ],
        checklist: ['Test a guest’s access to one representative customer folder.', 'Assign an owner to every unresolved device or sharing issue.'],
        sourceIds: ['microsoft-sharing', 'microsoft-security-overview']
      },
      {
        heading: '5. Finish with a repeatable review',
        paragraphs: [
          'Create a short register of gaps, owners, target dates and evidence. Suggested evidence includes a policy export, a successful access test and confirmation that a departed colleague can no longer sign in. Record exceptions with an expiry date.',
          'Start with the gaps that expose business email or privileged access, then schedule the remaining work. Repeat the review after a significant staff, domain or subscription change. A completed checklist is a record of work performed; it is not proof that compromise is impossible.'
        ],
        sourceIds: ['microsoft-mfa']
      }
    ],
    sources: [
      { id: 'microsoft-security-overview', label: 'Microsoft Learn — Microsoft 365 for business security overview', url: 'https://learn.microsoft.com/en-us/microsoft-365/admin/security-and-compliance/m365b-security-overview?view=o365-worldwide' },
      { id: 'microsoft-mfa', label: 'Microsoft Learn — Set up multifactor authentication for users', url: 'https://learn.microsoft.com/en-us/microsoft-365/admin/security-and-compliance/set-up-multi-factor-authentication?view=o365-worldwide' },
      { id: 'microsoft-security-defaults', label: 'Microsoft Learn — Security defaults in Microsoft Entra ID', url: 'https://learn.microsoft.com/en-us/entra/fundamentals/security-defaults' },
      { id: 'microsoft-email-deployment', label: 'Microsoft Learn — Get started with Microsoft Defender for Office 365', url: 'https://learn.microsoft.com/en-us/defender-office-365/mdo-deployment-guide' },
      { id: 'microsoft-sharing', label: 'Microsoft Learn — External sharing in SharePoint and OneDrive', url: 'https://learn.microsoft.com/en-us/sharepoint/external-sharing-overview' }
    ]
  },
  {
    slug: 'ransomware-readiness-growing-teams',
    title: 'Ransomware readiness for a growing team',
    summary: 'Identify essential services, test a clean restore and rehearse decisions before an incident interrupts the business.',
    category: 'Cyber Defence & Continuity',
    updatedAt: '2026-11-23',
    readingMinutes: 4,
    intro: 'As a team grows, its recovery plan must cover more than a folder of backups. Payroll, identity, customer records and supplier access may depend on different systems and people. This planning exercise helps a business turn ransomware readiness into a small set of demonstrable outcomes, with priorities chosen by the people responsible for keeping services running.',
    serviceIds: ['cyber-defense', 'cloud-continuity'],
    sections: [
      {
        heading: '1. Agree which business services come first',
        paragraphs: [
          'Choose three services whose loss would stop useful work. For each, list the application, data, identity provider, network access and supplier contact it depends on. Ask the business owner how long it can be unavailable and how much recent work could be recreated.',
          'Treat those answers as recovery targets to test, not guarantees. NIST’s incident-response guidance places preparation, detection, response and recovery within ongoing risk management. Your practical output is a prioritised service sheet that both technical and business staff can understand.'
        ],
        sourceIds: ['nist-incident-response']
      },
      {
        heading: '2. Prove that a useful restore is possible',
        paragraphs: [
          'CISA recommends offline, encrypted backups and regular recovery tests. Synchronised cloud folders alone may carry encrypted or deleted files into another location. Check that backup copies remain recoverable if the normal administrator account or production network is compromised.',
          'Restore a representative dataset in an isolated test environment. Open the files, verify permissions and confirm that the relevant application can use them. Record the backup’s age, time required, missing dependencies and who approved the result. Include configuration and recovery instructions in the scope.'
        ],
        checklist: ['Test access using the documented recovery process.', 'Keep an accessible record of the last successful restore.'],
        sourceIds: ['cisa-ransomware']
      },
      {
        heading: '3. Reduce the routes into critical systems',
        paragraphs: [
          'Review exposed remote-access services, administrator privileges, endpoint protection and patch ownership. Include backup software in the patch programme. NCSC guidance recommends separating backups and limiting opportunities for malware to spread between systems.',
          'Turn the review into a short queue: affected asset, business owner, planned action and verification step. Prioritise a reachable critical weakness over an attractive dashboard improvement. Agree any service interruption before the change, then check the business function afterwards.'
        ],
        sourceIds: ['ncsc-ransomware']
      },
      {
        heading: '4. Rehearse the first decisions',
        paragraphs: [
          'Run a tabletop exercise: staff cannot open shared files and the normal collaboration service is unavailable. Who declares an incident, contacts support and authorises isolation? Which alternative communication channel will the team use? Keep the contact list and decision authority available outside the affected systems.',
          'Include a record keeper. Capture discovery time, observations, decisions and actions with a consistent time zone. Preserve relevant logs before routine retention removes them. The exercise should reveal missing access or unclear responsibility while there is time to fix it.'
        ],
        checklist: ['Confirm the out-of-hours decision maker.', 'Test the alternative contact route with the agreed participants.'],
        sourceIds: ['ncsc-heightened-threat', 'nist-incident-response']
      },
      {
        heading: '5. Define a safe return to service',
        paragraphs: [
          'Plan recovery dependencies before reconnecting systems. NCSC recommends tested restoration processes and prioritising business-critical services. Include a way to reconcile orders or records created manually during the outage with restored data.',
          'End the exercise with named actions and a retest date. A backup report marked successful is one input; the stronger outcome is a demonstrated restore that the business owner can use. Keep readiness reviews current as applications, staff and suppliers change.'
        ],
        sourceIds: ['ncsc-technical-recovery']
      }
    ],
    sources: [
      { id: 'nist-incident-response', label: 'NIST SP 800-61 Rev. 3 — Incident response and cybersecurity risk management', url: 'https://csrc.nist.gov/pubs/sp/800/61/r3/final' },
      { id: 'cisa-ransomware', label: 'CISA — #StopRansomware Guide (PDF)', url: 'https://www.cisa.gov/sites/default/files/2025-03/StopRansomware-Guide%20508.pdf' },
      { id: 'ncsc-ransomware', label: 'NCSC — Mitigating malware and ransomware attacks', url: 'https://www.ncsc.gov.uk/guidance/mitigating-malware-and-ransomware-attacks' },
      { id: 'ncsc-heightened-threat', label: 'NCSC — Actions to take when the cyber threat is heightened', url: 'https://www.ncsc.gov.uk/guidance/actions-to-take-when-the-cyber-threat-is-heightened' },
      { id: 'ncsc-technical-recovery', label: 'NCSC — Prepare your technical recovery capability', url: 'https://www.ncsc.gov.uk/collection/disruptive-cyber-attacks/preparing/3-prepare-technical-recovery' }
    ]
  },
  {
    slug: 'siem-soar-first-workflow',
    title: 'SIEM and SOAR: choose a first useful workflow',
    summary: 'Start with one investigation, reliable input data and an approval boundary before expanding security automation.',
    category: 'Security Operations & Automation',
    updatedAt: '2026-11-23',
    readingMinutes: 4,
    intro: 'A first security workflow should save an analyst a recognisable piece of work and leave a clear record of the outcome. SIEM brings security events into a searchable investigation process; SOAR coordinates actions around that process. The example below is a proposed pilot for a suspicious sign-in alert, to be adapted to your systems, licences and change permissions.',
    serviceIds: ['cyber-defense', 'business-automation'],
    sections: [
      {
        heading: '1. Define one question and a useful outcome',
        paragraphs: [
          'Choose a question such as: does this sign-in alert need an analyst’s attention now? Define the alert source, identity, device and event window needed to answer it. Splunk Enterprise Security detections can use identity, endpoint, network and other data to generate findings for investigation.',
          'Start with a known detection and an agreed triage procedure. Write the expected output before building anything: one assigned case containing the source event, supporting context and a recommended next step.'
        ],
        sourceIds: ['splunk-detections']
      },
      {
        heading: '2. Make the input trustworthy',
        paragraphs: [
          'Check that the required logs arrive, timestamps are interpretable and the same person or device is identified consistently. Record the source event identifier and observation time. Missing enrichment must be visible as missing; it should not silently become evidence that an account is safe.',
          'For this pilot, specify how duplicate alerts are grouped, how late data is handled and who owns a failed connector. Use representative test records, including an unfamiliar but legitimate remote-working sign-in.'
        ],
        checklist: ['Reject or flag incomplete records.', 'Keep an analyst route for uncertain results.'],
        sourceIds: ['splunk-detections']
      },
      {
        heading: '3. Automate the repeatable investigation steps',
        paragraphs: [
          'Begin with permitted lookups: collect the relevant account and device context, link related alerts and prepare a case summary. Splunk SOAR playbooks support investigative actions and dependent steps, so the next action can use the previous action’s result.',
          'Use a service identity with only the permissions needed for the pilot. Define connector timeouts, bounded retries and a clear failed state. Avoid copying secrets or unnecessary personal information into case comments. Record which information was observed and which conclusion still needs an analyst.'
        ],
        sourceIds: ['splunk-automation-api']
      },
      {
        heading: '4. Put a person at the disruptive-action boundary',
        paragraphs: [
          'Disabling an account or isolating a working device can interrupt the business. For a first pilot, prepare a recommendation and require an authorised reviewer before those actions. Splunk SOAR supports action approval through configured approvers or a reviewer.',
          'Name the approval group, expiry rule and escalation route. An unanswered request should not become implicit permission. Record the decision, actual action result and recovery steps; approval alone does not prove that the action succeeded.'
        ],
        sourceIds: ['splunk-automation-api']
      },
      {
        heading: '5. Test exceptions before enabling the pilot',
        paragraphs: [
          'Test a true alert, a benign alert, missing data, duplicate delivery, a connector outage and an unavailable approver. Splunk’s playbook debugger runs saved, inactive playbooks against an event and records action inputs, outputs and status. Use test assets so a debugging run cannot disrupt production.',
          'Set a small launch scope and an owner who can stop the workflow. Compare analyst handling time, useful escalations, failures and reversals against the existing process. Review the evidence before adding another detection or allowing more automatic response. A successful pilot is a controlled, measurable improvement.'
        ],
        sourceIds: ['splunk-debugging']
      }
    ],
    sources: [
      { id: 'splunk-detections', label: 'Splunk — Use detections to search for threats in Enterprise Security', url: 'https://help.splunk.com/en/splunk-enterprise-security-8/administer/8.5/detections/use-detections-to-search-for-threats-in-splunk-enterprise-security' },
      { id: 'splunk-automation-api', label: 'Splunk SOAR — Playbook automation API and action approval', url: 'https://help.splunk.com/en/splunk-soar/soar-cloud/python-playbook-api-reference/automation-api/playbook-automation-api' },
      { id: 'splunk-debugging', label: 'Splunk SOAR — Debug playbooks', url: 'https://help.splunk.com/en/splunk-soar/soar-cloud/build-playbooks/manage-playbooks-and-playbook-settings/debug-playbooks-in-splunk-soar-cloud' }
    ]
  }
];
