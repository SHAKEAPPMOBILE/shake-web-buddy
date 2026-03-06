/**
 * Parse CSV exported from venues table.
 * Expected columns: city,name,address,venue_type,latitude,longitude,sort_order,is_active,id
 */
export interface CsvVenueRow {
  id: string;
  city: string;
  name: string;
  address: string;
  venue_type: 'lunch_dinner' | 'brunch' | 'drinks';
  latitude: number | null;
  longitude: number | null;
  sort_order: number;
  is_active: boolean;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    const trimmed = rest.trimStart();
    i += rest.length - trimmed.length;
    if (trimmed.length === 0) break;
    if (trimmed[0] === '"') {
      let end = 1;
      while (end < trimmed.length) {
        if (trimmed[end] === '"' && trimmed[end + 1] !== '"') break;
        if (trimmed[end] === '"' && trimmed[end + 1] === '"') end += 2;
        else end++;
      }
      fields.push(trimmed.slice(1, end).replace(/""/g, '"'));
      i += end + 1 + (trimmed[end + 1] === ',' ? 1 : 0);
    } else {
      const comma = trimmed.indexOf(',');
      if (comma === -1) {
        fields.push(trimmed.trim());
        break;
      }
      fields.push(trimmed.slice(0, comma).trim());
      i += comma + 1;
    }
  }
  return fields;
}

export function parseVenuesCsv(csvText: string): CsvVenueRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]);
  const cityIdx = header.indexOf('city');
  const nameIdx = header.indexOf('name');
  const addressIdx = header.indexOf('address');
  const venueTypeIdx = header.indexOf('venue_type');
  const latIdx = header.indexOf('latitude');
  const lngIdx = header.indexOf('longitude');
  const sortOrderIdx = header.indexOf('sort_order');
  const isActiveIdx = header.indexOf('is_active');
  const idIdx = header.indexOf('id');
  if (
    cityIdx === -1 ||
    nameIdx === -1 ||
    addressIdx === -1 ||
    venueTypeIdx === -1 ||
    idIdx === -1
  ) {
    throw new Error('CSV must have columns: city, name, address, venue_type, id');
  }
  const rows: CsvVenueRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const city = (cells[cityIdx] ?? '').trim();
    const name = (cells[nameIdx] ?? '').trim();
    const address = (cells[addressIdx] ?? '').trim();
    const venueType = (cells[venueTypeIdx] ?? '').trim();
    const id = (cells[idIdx] ?? '').trim();
    if (!city || !name || !address || !id) continue;
    if (!['lunch_dinner', 'brunch', 'drinks'].includes(venueType)) continue;
    const lat = latIdx >= 0 && cells[latIdx] ? parseFloat(cells[latIdx]) : null;
    const lng = lngIdx >= 0 && cells[lngIdx] ? parseFloat(cells[lngIdx]) : null;
    const sortOrder = sortOrderIdx >= 0 && cells[sortOrderIdx] ? parseInt(cells[sortOrderIdx], 10) : 0;
    const isActive = isActiveIdx >= 0 ? cells[isActiveIdx] !== 'false' && cells[isActiveIdx] !== '0' : true;
    rows.push({
      id,
      city,
      name,
      address,
      venue_type: venueType as 'lunch_dinner' | 'brunch' | 'drinks',
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      is_active: !!isActive,
    });
  }
  return rows;
}
