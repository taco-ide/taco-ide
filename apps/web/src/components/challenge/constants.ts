export const personalityTypes = [
    { id: "assertive", name: "Assertive", description: "Direct and objective in responses" },
    { id: "explanatory", name: "Explanatory", description: "Provides detailed explanations" },
    { id: "socratic", name: "Socratic", description: "Guides through questions" },
    { id: "encouraging", name: "Encouraging", description: "Motivates and encourages during resolution" },
];

export const difficultyLevels = [
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
] as const;
