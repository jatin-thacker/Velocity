function formatDate(input) {
  if (!input) return '';

  // If it’s already a string in MMM-dd-yyyy, just return it
  if (typeof input === 'string' && /^[A-Za-z]{3}-\d{2}-\d{4}$/.test(input.trim())) {
    return input.trim();
  }

  // Otherwise, try to parse it into a JS Date
  const d = new Date(input);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${input}`);
  }

  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  const mm = months[d.getMonth()];
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();

  return `${mm}-${dd}-${yyyy}`;
}

module.exports = { formatDate };
