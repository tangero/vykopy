import { z } from 'zod';
import type { Geometry } from 'geojson';

// Step 1: Basic Information Schema
export const basicInfoSchema = z.object({
  name: z.string()
    .min(3, 'Název projektu musí mít alespoň 3 znaky')
    .max(255, 'Název projektu může mít maximálně 255 znaků'),
  
  applicant_organization: z.string()
    .min(2, 'Název žadatele musí mít alespoň 2 znaky')
    .max(255, 'Název žadatele může mít maximálně 255 znaků'),
  
  contractor_organization: z.string()
    .min(2, 'Název zhotovitele musí mít alespoň 2 znaky')
    .max(255, 'Název zhotovitele může mít maximálně 255 znaků')
    .optional(),
  
  contractor_contact: z.object({
    name: z.string()
      .min(2, 'Jméno kontaktní osoby musí mít alespoň 2 znaky')
      .max(100, 'Jméno kontaktní osoby může mít maximálně 100 znaků'),
    phone: z.string()
      .regex(/^(\+420)?[0-9]{9}$/, 'Neplatné telefonní číslo (formát: +420123456789 nebo 123456789)'),
    email: z.string()
      .email('Neplatná emailová adresa')
      .max(255, 'Emailová adresa může mít maximálně 255 znaků')
  }).optional(),
  
  description: z.string()
    .max(2000, 'Popis může mít maximálně 2000 znaků')
    .optional()
});

// Step 2: Location Schema
export const locationSchema = z.object({
  geometry: z.custom<Geometry>((val) => {
    return val && typeof val === 'object' && 'type' in val && 'coordinates' in val;
  }, 'Musíte vybrat lokalitu na mapě'),
  
  affected_municipalities: z.array(z.string())
    .min(1, 'Projekt musí zasahovat alespoň do jedné obce')
});

// Step 3: Timeline and Categorization Schema
export const timelineSchema = z.object({
  start_date: z.string()
    .refine((date) => {
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, 'Datum zahájení nemůže být v minulosti'),
  
  end_date: z.string()
    .refine((date) => {
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, 'Datum ukončení nemůže být v minulosti'),
  
  work_type: z.string()
    .min(1, 'Musíte vybrat typ práce'),
  
  work_category: z.string()
    .min(1, 'Musíte vybrat kategorii práce')
}).refine((data) => {
  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  return endDate >= startDate;
}, {
  message: 'Datum ukončení musí být stejné nebo pozdější než datum zahájení',
  path: ['end_date']
});

// Complete project schema (all steps combined)
export const completeProjectSchema = basicInfoSchema
  .merge(locationSchema)
  .merge(timelineSchema);

// Type definitions
export type BasicInfoFormData = z.infer<typeof basicInfoSchema>;
export type LocationFormData = z.infer<typeof locationSchema>;
export type TimelineFormData = z.infer<typeof timelineSchema>;
export type CompleteProjectFormData = z.infer<typeof completeProjectSchema>;

// Work type and category options
export const workTypeOptions = [
  { value: 'excavation', label: 'Výkop' },
  { value: 'road_work', label: 'Práce na komunikaci' },
  { value: 'utility_installation', label: 'Instalace inženýrských sítí' },
  { value: 'maintenance', label: 'Údržba' },
  { value: 'emergency_repair', label: 'Havarijní oprava' },
  { value: 'reconstruction', label: 'Rekonstrukce' }
];

export const workCategoryOptions = [
  { value: 'water', label: 'Vodovod' },
  { value: 'sewer', label: 'Kanalizace' },
  { value: 'gas', label: 'Plyn' },
  { value: 'electricity', label: 'Elektřina' },
  { value: 'telecommunications', label: 'Telekomunikace' },
  { value: 'heating', label: 'Teplovod' },
  { value: 'road_infrastructure', label: 'Dopravní infrastruktura' },
  { value: 'other', label: 'Ostatní' }
];