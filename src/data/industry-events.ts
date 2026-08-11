export interface IndustryEvent {
  name: string;
  location: string;
  start: string; // ISO date
  end: string;   // ISO date
  url: string;
  focus: string;
}

/** Major metal cutting / machine tool trade shows. */
export const INDUSTRY_EVENTS: IndustryEvent[] = [
  { name: 'IMTS – International Manufacturing Technology Show', location: 'Chicago, USA', start: '2026-09-14', end: '2026-09-19', url: 'https://www.imts.com', focus: 'Machine tools, metal cutting, automation' },
  { name: 'AMB Stuttgart', location: 'Stuttgart, Germany', start: '2026-09-15', end: '2026-09-19', url: 'https://www.messe-stuttgart.de/amb', focus: 'Metal working & precision tooling' },
  { name: 'JIMTOF', location: 'Tokyo, Japan', start: '2026-11-05', end: '2026-11-10', url: 'https://www.jimtof.org', focus: 'Japan machine tool fair' },
  { name: 'METALEX', location: 'Bangkok, Thailand', start: '2026-11-18', end: '2026-11-21', url: 'https://www.metalex.co.th', focus: 'ASEAN metalworking' },
  { name: 'MACH', location: 'Birmingham, UK', start: '2026-04-13', end: '2026-04-16', url: 'https://www.machexhibition.com', focus: 'UK manufacturing technologies' },
  { name: 'EMO Hannover', location: 'Hannover, Germany', start: '2027-09-20', end: '2027-09-25', url: 'https://www.emo-hannover.de', focus: 'World fair for production technology' },
  { name: 'ISTECH / Israel Manufacturing Expo', location: 'Tel Aviv, Israel', start: '2026-12-01', end: '2026-12-02', url: 'https://www.stier-group.com', focus: 'Israeli precision manufacturing' },
  { name: 'CIMT – China International Machine Tool Show', location: 'Beijing, China', start: '2027-04-12', end: '2027-04-17', url: 'https://www.cimtshow.com', focus: 'Asia machine tool market' },
];
