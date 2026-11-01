const paths={
 wood:'<path fill="#976638" d="M7 22 20 7l7 8-13 15z"/><ellipse cx="10" cy="26" rx="6" ry="5" fill="#e6bd7c"/><ellipse cx="10" cy="26" rx="3" ry="2.5" fill="none" stroke="#956439"/><path d="m16 19 9-10M19 23l8-10" stroke="#603f28"/>',
 brick:'<path fill="#d47b55" d="m4 18 16-8 12 6-16 9z"/><path fill="#a24e38" d="M4 18v9l12 6v-8z"/><path fill="#edaa75" d="m16 25 16-9v9l-16 8z"/><path d="m12 14 12 7M11 22v8M24 21v9" stroke="#683b2e"/>',
 wool:'<path d="M10 26v6m13-6v6" stroke="#6b5440" stroke-width="3"/><path fill="#eee9d5" d="M7 23C0 16 7 10 12 12c1-9 12-8 14-1 10-1 12 12 4 15-3 7-10 4-12 2-7 6-15 1-11-5"/><path fill="#615c50" d="M26 17c11-5 12 7 6 10l-7-5z"/><circle cx="32" cy="20" r="1" fill="white"/>',
 grain:'<path d="M18 33V7m0 13L8 10m10 15 11-12" stroke="#c79a3d" stroke-width="2"/><g fill="#f1ca64"><ellipse cx="18" cy="8" rx="3" ry="6"/><ellipse cx="11" cy="15" rx="3" ry="6" transform="rotate(-40 11 15)"/><ellipse cx="24" cy="15" rx="3" ry="6" transform="rotate(40 24 15)"/><ellipse cx="12" cy="23" rx="3" ry="6" transform="rotate(-40 12 23)"/><ellipse cx="25" cy="23" rx="3" ry="6" transform="rotate(40 25 23)"/></g>',
 ore:'<path fill="#829dab" d="m3 26 7-14 12-7 11 17-6 10H10z"/><path fill="#bcccd2" d="m10 12 12-7-3 18-16 3z"/><path fill="#536c7c" d="m19 23 14-1-6 10H10z"/>',
 settlement:'<path d="m5 18 13-12 13 12v14H8V18z" fill="currentColor"/><path d="M15 32V22h7v10" fill="#18343b"/><path d="m3 18 15-14 15 14" fill="none" stroke="currentColor" stroke-width="3"/>',
 city:'<path d="M3 32V18l9-8 9 8v14zm18 0V9l6-6 6 6v23z" fill="currentColor"/><path d="M9 32v-9h6v9m10-20h4m-4 6h4" stroke="#18343b" stroke-width="3"/>',
 road:'<path d="m5 29 25-19" stroke="#102c32" stroke-width="13" stroke-linecap="round"/><path d="m5 27 25-19" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
 development:'<rect x="7" y="5" width="22" height="29" rx="3" fill="currentColor"/><path d="m18 10 3 6 6 1-4 5 1 7-6-3-6 3 1-7-4-5 6-1z" fill="#18343b"/>',
 trade:'<path d="M4 12h27l-7-7M32 25H5l7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
 knight:'<path d="m8 32 2-10 9-6-6-3 6-10 10 7v22z" fill="currentColor"/><circle cx="23" cy="11" r="2" fill="#18343b"/>',
 trophy:'<path d="M11 5h15v13c0 10-15 10-15 0zM18 26v7m-7 0h15M11 9H5v6c0 6 6 6 6 6M26 9h6v6c0 6-6 6-6 6" fill="none" stroke="currentColor" stroke-width="3"/>',
 dice:'<rect x="4" y="4" width="28" height="28" rx="6" fill="currentColor"/><g fill="#18343b"><circle cx="12" cy="12" r="2.5"/><circle cx="24" cy="12" r="2.5"/><circle cx="18" cy="18" r="2.5"/><circle cx="12" cy="24" r="2.5"/><circle cx="24" cy="24" r="2.5"/></g>',
};
export const icon=key=>`<svg class="ct-icon" viewBox="0 0 36 36" aria-hidden="true">${paths[key]??paths.development}</svg>`;
