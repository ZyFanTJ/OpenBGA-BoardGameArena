/** Only fetch data needed by this surface. Cosmetics are shared by friend cards and profiles. */
export async function loadHubPage(api, section, {target, filters} = {}) {
  if (section === 'shop') return {shop: await api('/shop')};
  if (section === 'history') return {history: await api('/history?' + new URLSearchParams(filters))};
  const [shop, page] = await Promise.all([
    api('/shop'),
    api(section === 'friends' ? '/friends' : target ? `/profiles/${target}` : '/profile'),
  ]);
  return section === 'friends' ? {shop, friends: page} : {shop, profilePage: page};
}
