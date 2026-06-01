const VALID_SEVERITIES = new Set(['bon', 'use', 'endommage', 'critique'])

export default class RepairParser {
  parse(json) {
    if (!Array.isArray(json?.repairs)) return []
    return json.repairs.map(r => ({
      id:          String(r.id ?? ''),
      name:        String(r.name ?? ''),
      description: String(r.description ?? ''),
      severity:    VALID_SEVERITIES.has(r.severity) ? r.severity : 'use',
      repairable:  Boolean(r.repairable),
      replaceable: Boolean(r.replaceable),
      pieces:      Array.isArray(r.pieces)
        ? r.pieces.map(p => ({ mesh: String(p.mesh ?? ''), name: String(p.name ?? '') }))
        : [],
    })).filter(r => r.id && r.pieces.length > 0)
  }

  parseVehicle(json) {
    const v = json?.vehicle ?? {}
    return {
      name:           String(v.name ?? ''),
      year:           Number(v.year ?? 0),
      immatriculation: String(v.immatriculation ?? ''),
      km:             Number(v.km ?? 0),
      fuel_level:     Number(v.fuel_level ?? 0),
      fuel_type:      String(v.fuel_type ?? ''),
    }
  }

  parseMeta(json) {
    return {
      context:           String(json?.context ?? ''),
      priority:          String(json?.priority ?? ''),
      repair_delay_days: Number(json?.repair_delay_days ?? 0),
      available_parts:   Array.isArray(json?.available_parts) ? json.available_parts : [],
      repair_history:    Array.isArray(json?.repair_history)  ? json.repair_history  : [],
    }
  }
}
