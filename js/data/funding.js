/* ============ funding.js — donations ============
 * Donations are voluntary, give no advantage in the game and are
 * only used to keep it online: servers and domain.
 * This file is the source of what's shown in the game ("Support" button)
 * and on the /apoyar/ page. It's updated by hand:
 *
 *   kofi      Ko-fi username (empty = the button doesn't appear)
 *   sponsors  GitHub Sponsors username (for people visiting the repository)
 *   costs     expenses [item, euros per month]; if the cost isn't fixed, a text
 */
G.Funding = {
  kofi: '',          // empty on purpose: this project doesn't ask for donations (the Support button is a joke)
  sponsors: '',
  costs: [
    ['Servidores (partidas, cuentas, ranking y multijugador)', 'Según cuánta gente juegue'],
    ['Dominio pokesurvivor.com', '≈12 € al año']
  ],
  get url() { return this.kofi ? 'https://ko-fi.com/' + this.kofi : ''; }
};
