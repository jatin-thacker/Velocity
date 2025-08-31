// helpers/views.js
const views = {
  Login: {
    url: /\/login/,
    ready: async (page) => {
      await page.getByTestId('username').waitFor();
      await page.getByRole('button', { name: /sign in/i }).waitFor();
    }
  },
  Dashboard: {
    url: /\/dashboard/,
    ready: async (page) => {
      await page.getByTestId('navbar-user').waitFor();
    }
  }
};

async function ensureView(page, name) {
  const v = views[name];
  if (!v) throw new Error(`Unknown view "${name}"`);
  if (v.url && !v.url.test(page.url())) {
    // optional: navigate or throw
  }
  await v.ready(page);
}

module.exports = { ensureView, views };
