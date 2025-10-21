import { z } from 'zod';
import type { Geometry } from 'geojson';

// Moratorium form schema
export const moratoriumSchema = z.object({
  name: z.string()
    .min(3, 'Název moratoria musí mít alespoň 3 znaky')
    .max(255, 'Název moratoria může mít maximálně 255 znaků'),
  
  geometry: z.custom<Geometry>((val) => {
    return val && typeof val === 'object' && 'type' in val && 'coordinates' in val;
  }, 'Musíte vyznačit oblast moratoria na mapě'),
  
  reason: z.string()
    .min(1, 'Musíte vybrat důvod moratoria'),
  
  reasonDetail: z.string()
    .max(1000, 'Podrobný popis může mít maximálně 1000 znaků')
    .optional(),
  
  validFrom: z.string()
    .refine((date) => {
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, 'Datum začátku platnosti nemůže být v minulosti'),
  
  validTo: z.string()
    .refine((date) => {
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, 'Datum konce platnosti nemůže být v minulosti'),
  
  exceptions: z.string()
    .max(500, 'Výjimky mohou mít maximálně 500 znaků')
    .optional(),
  
  municipalityCode: z.string()
    .min(1, 'Musíte vybrat obec')
}).refine((data) => {
  const startDate = new Date(data.validFrom);
  const endDate = new Date(data.validTo);
  return endDate >= startDate;
}, {
  message: 'Datum konce platnosti musí být stejné nebo pozdější než datum začátku',
  path: ['validTo']
}).refine((data) => {
  const startDate = new Date(data.validFrom);
  const endDate = new Date(data.validTo);
  const maxEndDate = new Date(startDate);
  maxEndDate.setFullYear(maxEndDate.getFullYear() + 5);
  return endDate <= maxEndDate;
}, {
  message: 'Moratorium nemůže trvat déle než 5 let',
  path: ['validTo']
});

// Type definition
export type MoratoriumFormData = z.infer<typeof moratoriumSchema>;

// Reason options for moratoriums
export const moratoriumReasonOptions = [
  { value: 'road_reconstruction', label: 'Rekonstrukce komunikace' },
  { value: 'fresh_asphalt', label: 'Čerstvě položený asfalt' },
  { value: 'major_infrastructure', label: 'Výstavba významné infrastruktury' },
  { value: 'environmental_protection', label: 'Ochrana životního prostředí' },
  { value: 'archaeological_research', label: 'Archeologický výzkum' },
  { value: 'safety_concerns', label: 'Bezpečnostní důvody' },
  { value: 'planned_development', label: 'Plánovaná výstavba' },
  { value: 'other', label: 'Jiný důvod' }
];

// Municipality options (this would typically come from an API)
export const municipalityOptions = [
  { value: '532568', label: 'Praha' },
  { value: '529303', label: 'Benešov' },
  { value: '532061', label: 'Beroun' },
  { value: '529419', label: 'Brandýs nad Labem-Stará Boleslav' },
  { value: '529451', label: 'Černošice' },
  { value: '529478', label: 'Dobříš' },
  { value: '529516', label: 'Hořovice' },
  { value: '529541', label: 'Jesenice' },
  { value: '529575', label: 'Kladno' },
  { value: '529621', label: 'Kolín' },
  { value: '529664', label: 'Kralupy nad Vltavou' },
  { value: '529711', label: 'Kutná Hora' },
  { value: '529745', label: 'Lysá nad Labem' },
  { value: '529788', label: 'Mělník' },
  { value: '529834', label: 'Mladá Boleslav' },
  { value: '529885', label: 'Neratovice' },
  { value: '529915', label: 'Nymburk' },
  { value: '529958', label: 'Poděbrady' },
  { value: '530018', label: 'Příbram' },
  { value: '530051', label: 'Rakovník' },
  { value: '530093', label: 'Říčany' },
  { value: '530131', label: 'Slaný' },
  { value: '530174', label: 'Vlašim' }
];