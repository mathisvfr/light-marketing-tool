// Shared button-group voor rij-acties (Dashboard/CW/Gp/Gebr tabellen). Flex-
// container met consistente gap, wrapt op mobiel. Aligns rechts standaard;
// override via className.
//
// De KNOPPEN zelf blijven page-specifiek (bijv. `.dashboard-actions button`
// heeft eigen brand-styling) — deze component is puur layout-container zodat
// alle table-actions tool-breed dezelfde spacing hebben.
//
// Missing-states matrix (ActionButtonGroup):
// - Default: flex row + gap
// - Single button: rendert zonder wrapper-overhead
// - All disabled: parent laat button-attribuut over
// - Mobile: buttons stapelen full-width via CSS media query

export default function ActionButtonGroup({ align = 'end', className = '', children }) {
  return (
    <div className={`action-group action-group-${align} ${className}`.trim()}>
      {children}
    </div>
  );
}
