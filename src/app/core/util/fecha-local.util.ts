/** Fecha calendario local en formato ISO (yyyy-MM-dd), sin desfase por UTC. */
export function fechaHoyIsoLocal(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Rango del mes calendario actual (desde/hasta en ISO local). */
export function rangoMesEnCurso(): { desde: string; hasta: string } {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ultimoDia = new Date(y, m + 1, 0).getDate();
  return { desde: `${y}-${pad(m + 1)}-01`, hasta: `${y}-${pad(m + 1)}-${pad(ultimoDia)}` };
}
