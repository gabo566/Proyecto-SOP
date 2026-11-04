// Pone a cada celda el nombre de su columna para que, en pantallas angostas,
// cada fila de una tabla se lea como una tarjeta con etiquetas.
function labelResponsiveTables(root) {
  root.querySelectorAll(".table-scroll table").forEach((table) => {
    const labels = [...table.querySelectorAll("thead th")].map((th) => th.textContent.trim());
    if (!labels.length) return;
    table.querySelectorAll("tbody tr").forEach((row) => {
      [...row.children].forEach((cell, index) => {
        if (cell.tagName !== "TD" || cell.hasAttribute("colspan")) return;
        cell.dataset.label = labels[index] ?? "";
      });
    });
  });
}
