export const strategyFixture = () => ({
  title: 'Launch brief', summary: 'A measurable launch strategy.',
  context: { business: 'Software', objective: 'Launch', market: 'Global', targetAudience: 'Teams' },
  sections: ['Strategy', 'Constraints', 'Acceptance'].map((title, i) => ({ id: `s${i}`, title, summary: title, content: `${title}: documented requirements.`, bullets: [] })),
  priorities: [{ title: 'Validate', description: 'Validate demand', priority: 'high' }],
  actionPlan: [{ phase: 'Pilot', actions: ['Run pilot'], expectedOutcome: '10 validated teams' }],
  kpis: [{ name: 'Pilot', reason: 'Demand', target: '10 teams' }], risks: [], assumptions: [], nextSteps: ['Prepare pilot'],
});
