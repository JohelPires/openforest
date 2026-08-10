export interface ProjectFormDefaults {
  name?: string;
  goal?: string | null;
  description?: string | null;
  start_date?: string | null;
  responsible?: string | null;
}

export const inputClasses =
  "h-11 w-full rounded-xl border border-forest/15 bg-mist/40 px-3.5 text-sm text-forest placeholder:text-moss/40 transition-shadow duration-300 focus:border-forest focus:bg-cream focus:outline-none focus:ring-4 focus:ring-forest/15";

export const labelClasses = "mb-1.5 block text-sm font-medium text-forest";

interface ProjectFormFieldsProps {
  defaults?: ProjectFormDefaults;
  idPrefix: string;
}

export function ProjectFormFields({ defaults, idPrefix }: ProjectFormFieldsProps) {
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-name`} className={labelClasses}>
          Nome do projeto
        </label>
        <input
          id={`${idPrefix}-name`}
          name="name"
          type="text"
          required
          defaultValue={defaults?.name}
          placeholder="Ex.: Corredor do Ribeirão"
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-goal`} className={labelClasses}>
          Objetivo
        </label>
        <input
          id={`${idPrefix}-goal`}
          name="goal"
          type="text"
          defaultValue={defaults?.goal ?? ""}
          placeholder="O que essa restauração quer alcançar?"
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-description`} className={labelClasses}>
          Descrição
        </label>
        <textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={3}
          defaultValue={defaults?.description ?? ""}
          placeholder="Conte um pouco sobre o projeto"
          className={`${inputClasses} ruled-lines resize-none py-3 leading-[27px]`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-start-date`} className={labelClasses}>
            Início
          </label>
          <input
            id={`${idPrefix}-start-date`}
            name="start_date"
            type="date"
            defaultValue={defaults?.start_date ?? new Date().toISOString().slice(0, 10)}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-responsible`} className={labelClasses}>
            Responsável
          </label>
          <input
            id={`${idPrefix}-responsible`}
            name="responsible"
            type="text"
            defaultValue={defaults?.responsible ?? ""}
            autoComplete="name"
            placeholder="Quem lidera o projeto"
            className={inputClasses}
          />
        </div>
      </div>
    </>
  );
}
