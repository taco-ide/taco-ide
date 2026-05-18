const PT_PATTERN =
  /[ãõâêôáéíóúàçÃÕÂÊÔÁÉÍÓÚÀÇ]|\b(é|não|sim|como|isso|mas|por|para|uma|com|você|estou|tenho|olá|bom|dia|tarde|noite|obrigado|obrigada|exercício|código)\b/i;

export function detectLanguageHint(message: string): string {
  return PT_PATTERN.test(message) ? "Portuguese (Brazil)" : "English";
}
