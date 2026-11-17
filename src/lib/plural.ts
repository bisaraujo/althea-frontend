/** "1 gestor", "2 gestores", "0 gestores": numero + palavra no singular ou no plural. */
export function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
