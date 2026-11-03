function renderHelpDialog() {
  return `<dialog class="app-dialog help-dialog" id="help-dialog" aria-labelledby="help-dialog-title">
    <div class="dialog-header"><div><h2 id="help-dialog-title">Ayuda · datos locales</h2><p>Cómo conservar y exportar la información de este navegador.</p></div>
      <button class="icon-button" type="button" data-action="close-help" data-focus-key="help-close" aria-label="Cerrar ayuda"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div>
    <section class="help-section"><h3>¿Dónde se guardan?</h3><p>Las validaciones, usuarios demo y trabajos detenidos se guardan en el almacenamiento local de este navegador. Las fotos y el PDF SOP que selecciones se guardan en IndexedDB del navegador.</p><p>Los datos solo están disponibles en este navegador y perfil. No se envían a GitHub ni se sincronizan con otros equipos. Evita borrar los datos del sitio o el perfil del navegador.</p></section>
    <section class="help-section"><h3>Exportar registros</h3><p>Abre <strong>Trazabilidad</strong> o <strong>Reportes</strong> y pulsa <strong>Exportar CSV</strong>. Se descargan los registros que coinciden con los filtros; en Reportes puedes incluir datos demo.</p><p>El CSV contiene campos de registro, no incluye fotos ni reemplaza un respaldo completo del navegador.</p></section>
    <section class="help-section"><h3>Extraer y actualizar SOP</h3><p>En <strong>Modificar SOP</strong>, pulsa <strong>Subir PDF</strong> para elegir el archivo y después <strong>Extraer SOP</strong> para detectar los pasos. Revisa y corrige el borrador antes de guardar la nueva revisión; quedará en este navegador hasta que Administración la habilite en el catálogo.</p></section>
    <p class="help-demo-note"><span class="material-symbols-rounded" aria-hidden="true">info</span>El acceso de usuario y los permisos siguen siendo de demostración local; no son autenticación segura.</p>
  </dialog>`;
}
