export type RestorationStatus =
  | "planned"
  | "active"
  | "completed"
  | "cancelled";

export const STATUS_LABEL: Record<RestorationStatus, string> = {
  planned: "Planejada",
  active: "Em restauração",
  completed: "Recuperada",
  cancelled: "Cancelada",
};

export const STATUS_BADGE: Record<RestorationStatus, string> = {
  planned: "border-gold/30 bg-gold/15 text-forest",
  active: "border-forest/15 bg-sage/35 text-forest",
  completed: "border-forest/20 bg-forest/10 text-forest",
  cancelled: "border-soil/30 bg-soil/15 text-moss",
};

export const STATUS_DOT: Record<RestorationStatus, string> = {
  planned: "border-gold bg-gold",
  active: "border-moss bg-moss",
  completed: "border-forest bg-forest",
  cancelled: "border-soil bg-soil",
};
