/** A query filter only: never interpret this value as a redirect destination. */
export function parseTaskTeamFilter(value:unknown):string|undefined {
  if(value==="unassigned")return value;
  if(typeof value!=="string"||!/^\d+$/.test(value))return undefined;
  const number=Number(value);
  return Number.isSafeInteger(number)&&number>0?String(number):undefined;
}
