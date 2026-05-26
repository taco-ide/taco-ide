import { z } from "zod";

export const challengeFormSchema = z.object({
    title: z.string().min(1, "Titulo e obrigatorio").max(200),
    description: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"], {
        required_error: "Selecione a dificuldade",
    }),
    classroomId: z.string().min(1, "Selecione uma turma"),
    tags: z.array(z.string()).optional(),
    generateReferenceSolutions: z.boolean().optional(),
});

export type ChallengeFormData = z.infer<typeof challengeFormSchema>;
