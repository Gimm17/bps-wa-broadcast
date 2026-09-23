/**
 * Resolves a template parameter mapping against contact data or literal value.
 */
export function resolveParamValue(mapping, contact = null) {
  if (!mapping) return '';

  if (mapping.source === 'literal') {
    return mapping.value || '';
  }

  if (mapping.source === 'contact.name') {
    return contact?.name || 'Rekan Statistik';
  }

  if (mapping.source === 'contact.phone') {
    return contact?.phone_e164 || '';
  }

  if (mapping.source === 'employee.nip') {
    return contact?.nip || '-';
  }

  if (mapping.source === 'employee.unit_kerja') {
    return contact?.unit_kerja || 'BPS Provinsi Sulawesi Tengah';
  }

  return mapping.value || '';
}

/**
 * Renders complete text of template components with parameters substituted.
 */
export function renderTemplateText(components = [], params = {}, contact = null) {
  if (!Array.isArray(components)) return '';

  const bodyComp = components.find(c => c.type === 'BODY');
  if (!bodyComp || !bodyComp.text) return '';

  let rendered = bodyComp.text;

  // Substitute each {{N}}
  rendered = rendered.replace(/\{\{(\d+)\}\}/g, (match, paramIdx) => {
    const mapping = params[paramIdx];
    if (mapping) {
      return resolveParamValue(mapping, contact);
    }
    return match;
  });

  return rendered;
}

/**
 * Builds Meta Cloud API components array with parameters formatted for WhatsApp.
 */
export function buildMetaComponents(templateComponents = [], params = {}, contact = null) {
  const result = [];

  const bodyComp = templateComponents.find(c => c.type === 'BODY');
  if (bodyComp && bodyComp.text) {
    const matches = bodyComp.text.match(/\{\{(\d+)\}\}/g);
    if (matches && matches.length > 0) {
      const distinctIndices = [...new Set(matches.map(m => m.replace(/[\{\}]/g, '')))].sort((a, b) => Number(a) - Number(b));

      const bodyParameters = distinctIndices.map(idx => {
        const mapping = params[idx];
        const val = resolveParamValue(mapping, contact);
        return {
          type: 'text',
          text: String(val)
        };
      });

      result.push({
        type: 'body',
        parameters: bodyParameters
      });
    }
  }

  return result;
}

/**
 * Validates that all variables present in template components are mapped.
 */
export function validateTemplateParams(components = [], params = {}) {
  const missingParams = [];

  const bodyComp = components.find(c => c.type === 'BODY');
  if (bodyComp && bodyComp.text) {
    const matches = bodyComp.text.match(/\{\{(\d+)\}\}/g);
    if (matches) {
      const distinctIndices = [...new Set(matches.map(m => m.replace(/[\{\}]/g, '')))];
      for (const idx of distinctIndices) {
        if (!params[idx] || (!params[idx].source && !params[idx].value)) {
          missingParams.push(idx);
        }
      }
    }
  }

  return {
    valid: missingParams.length === 0,
    missingParams
  };
}
