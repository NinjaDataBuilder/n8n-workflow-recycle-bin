export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

export function normalizeSearchTerms(query) {
  const values = Array.isArray(query) ? query : [query];
  const normalized = values
    .flatMap((value) => String(value ?? '').split(','))
    .map(normalizeSearchText)
    .filter(Boolean);
  return [...new Set(normalized)];
}

export function appendSearchTerm(terms, rawTerm) {
  const displayTerm = String(rawTerm ?? '').trim();
  const normalizedTerm = normalizeSearchText(displayTerm);
  if (!normalizedTerm) return [...terms];
  if (terms.some((term) => normalizeSearchText(term) === normalizedTerm)) return [...terms];
  return [...terms, displayTerm];
}

export function consumeDelimitedInput(value) {
  const parts = String(value ?? '').split(',');
  if (parts.length === 1) return { committed: [], remainder: parts[0] };
  return {
    committed: parts.slice(0, -1).map((part) => part.trim()).filter(Boolean),
    remainder: parts.at(-1).trim(),
  };
}

export function filterWorkflowItems(items, query) {
  const terms = normalizeSearchTerms(query);
  if (terms.length === 0) return [...items];
  return items.filter((item) => {
    const workflowName = normalizeSearchText(item.workflowName);
    return terms.every((term) => workflowName.includes(term));
  });
}

export function buildSearchFeedback(total, visible, query) {
  const hasQuery = normalizeSearchTerms(query).length > 0;
  if (!hasQuery) {
    return {
      countText: `${total} archived workflow${total === 1 ? '' : 's'}`,
      emptyText: 'No archived workflows are visible to your account.',
    };
  }
  return {
    countText: `${visible} of ${total} archived workflow${total === 1 ? '' : 's'} found`,
    emptyText: 'No archived workflows match the search terms.',
  };
}
