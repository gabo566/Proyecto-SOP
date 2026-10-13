const TODAY = new Date();

const TODAY_DATE_LABEL = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
}).format(TODAY).replaceAll(".", "");

const TODAY_DATE_KEY = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}-${String(TODAY.getDate()).padStart(2, "0")}`;

const SOP_DOCUMENT = {
  id: "SOP-NVD-GB200-141",
  title: "Desensamble general de Compu tray modelo 2000",
  pdfPath: "./public/documents/SOP-NVD-GB200-141.pdf",
  revision: "3",
  family: "GB200",
  customer: "Nvidia Racks",
  station: "Rework",
  nodePartNumber: "675-24975-2000-000",
  totalSheets: 46,
  processSheets: 42,
  processSheetRange: "5–46",
};

function createProcedure(sheet, category, title, stepRange, partNumber, steps) {
  return {
    id: `sheet-${sheet}`,
    sheet,
    category,
    title,
    stepRange,
    partNumber,
    steps: steps.map(([number, text]) => {
      const stepId = String(number);
      const imageName = stepId.replaceAll(".", "-");
      return {
        number: stepId,
        text,
        images: [{
          src: `./public/assets/sop-step-references/sheet-${sheet}-step-${imageName}.jpg`,
          alt: `Referencia visual del paso ${stepId}, hoja ${sheet}`,
        }],
      };
    }),
  };
}

const PROCEDURES = [
  createProcedure(5, "Chasis", "Preparación del nodo y retiro de manijas", "1–3", "", [
    [1, "Coloque el chasis del nodo sobre el carrito de trabajo."],
    [2, "Retire la tapa del chasis y colóquela debajo del carrito."],
    [3, "Retire los 4 tornillos de cada manija. Guarde los tornillos para el ensamble. Torque indicado: 4.8–5.3 in-lb, punta PH2."],
  ]),
  createProcedure(6, "Busbar", "Retiro de soporte y conexiones Busbar", "4–6", "755-24975-0001-001", [
    [4, "Retire los 4 tornillos del soporte central en la secuencia indicada; el tornillo superior se retira con punta PH1."],
    [5, "Retire el soporte del Busbar y sus tornillos. Conserve los tornillos para el ensamble."],
    [6, "Desconecte el Busbar (PN 755-24975-0001-001) y sus conexiones. Apriete indicado para el ensamble: 4.8–5.3 in-lb con punta PH2."],
  ]),
  createProcedure(7, "Busbar", "Desmontaje de Busbar y ventiladores", "7–8.1.2", "755-24975-0001-001 / 755-24975-0040-001", [
    [7, "Retire el Busbar jalándolo verticalmente hacia arriba."],
    ["7.1", "Realice el reemplazo del cable Busbar."],
    ["7.1.1", "Retire el bracket quitando los 4 tornillos (2 por lado), retire el protector inferior y conserve los tornillos. Torque indicado: 4.5–5.5 in-lb con punta PH2."],
    [8, "Desconecte y retire el ventilador (PN 755-24975-0040-001) levantándolo hacia arriba."],
    ["8.1", "Realice el reemplazo de los ventiladores."],
    ["8.1.1", "Desensamble las ranuras de los ventiladores conforme a la secuencia ilustrada."],
    ["8.1.2", "Retire los plugs SR-3DM-NOB-A y SR-3DM-NOB-Z de ambos lados. Repita el mismo método en las dos ranuras de 3 ventiladores."],
  ]),
  createProcedure(8, "BMC", "Desmontaje de tarjeta BMC y cables MCIO", "9–10", "692-13809-2404-000", [
    [9, "Desconecte los cables HMC-BMC MCIO #1 (PN 755-24975-0010-A08) y #2 (PN 755-24975-0032-A08) de la BMC Interpose (PN 688-24975-0008-000), en J4 y J3 respectivamente."],
    [10, "Retire el módulo BMC (PN 692-13809-2404-000) con torque de 4.8–5.3 in-lb y punta PH2."],
  ]),
  createProcedure(9, "Cold Plate / Manifold", "Mangueras y manifolds internos", "11–13", "754-24975-0019-002 / 754-24975-0020-002", [
    [11, "Retire los tornillos de los manifolds izquierdo y derecho. Torque indicado: 4.8–5.3 in-lb con punta PH2."],
    [12, "Desconecte las mangueras de agua fría y caliente de ambos Cold Plates; mueva el pestillo hacia atrás."],
    [13, "Retire del chasis y de las Biancas los manifolds interiores PN 754-24975-0019-002 y PN 754-24975-0020-002."],
  ]),
  createProcedure(10, "Bianca", "Desconexión de cables Management y CLink", "14–15", "755-24975-0046-A01 / 755-24975-0049-A01", [
    [14, "Desconecte el cable 2P Management crossover (PN 755-24975-0046-A01) entre MB(L) J79 de la Bianca izquierda y MB(R) J58 de la derecha."],
    [15, "Desconecte el cable CLink MCIO (PN 755-24975-0049-A01) de MB(L) y MB(R), conectores J107."],
  ]),
  createProcedure(11, "Bianca", "Desconexión de riser PCIe y NIC 1G", "16–17", "753-24974-0012-A03 / 755-24975-0044-A01", [
    [16, "Desconecte el cable PCIe riser (PN 753-24974-0012-A03) en MB(R) J80 y J10 de la Bianca derecha."],
    [17, "Desconecte el cable MCIO de NIC 1G (PN 755-24975-0044-A01) en MB(L) J117; tire de la lengüeta azul."],
  ]),
  createProcedure(12, "Bianca", "Desconexión de cables de bahía izquierda", "18–19", "755-24975-0047-A01", [
    [18, "Desconecte los cables PCIe de la bahía izquierda en los conectores J10 y J80 de la Bianca izquierda, siguiendo el ruteo ilustrado."],
    [19, "Desconecte el cable Front Panel IO (PN 755-24975-0047-A01) de MB(L) J82."],
  ]),
  createProcedure(13, "Bianca", "Retiro de M.2, HMC y TPM", "20–21", "750-0411-000 / 692-24764-0001-000 / 699-23177-0000-ING", [
    [20, "Retire el módulo M.2 (PN 750-0411-000) de la Bianca derecha. Torque indicado: 4.8–5.3 in-lb con punta PH2."],
    [21, "Retire el HMC (PN 692-24764-0001-000) y el TPM (PN 699-23177-0000-ING) de la Bianca izquierda. Torque indicado: 4.8–5.3 in-lb con punta PH2."],
  ]),
  createProcedure(14, "Bianca", "Preparación para desmontaje CX7", "22–22.2", "FOXMXOTR-2620460", [
    [22, "Inicie el desmontaje del CX7 siguiendo la secuencia de preparación."],
    ["22.1", "Inserte el fixture FOXMXOTR-2620460 en ambas Biancas."],
    ["22.2", "Afloje y retire la cubierta de conexión en ambas Biancas con punta T15. Torque indicado: 4.8–5.3 in-lb."],
  ]),
  createProcedure(15, "Bianca", "Extracción de cables Ultrapass", "22.3–22.5", "FOXMXOTR-2620461 / FOXMXOTR-2620472", [
    ["22.3", "Use el fixture FOXMXOTR-2620461 como guía para retirar el Ultrapass."],
    ["22.4", "Coloque el fixture FOXMXOTR-2620472: presione los botones laterales e introdúzcalo por la ranura."],
    ["22.5", "Retire con cuidado ambos cables Ultrapass a través del fixture. No toque ni dañe los pines; inspecciónelos y coloque los protectores. Proteja el cable y verifique que la Bianca izquierda tenga cinta Kapton; agréguela si falta."],
  ]),
  createProcedure(16, "Bianca", "Limpieza condicional y cables laterales", "22.5.1–23.1", "755-24975-0054-A01 / 755-24975-0027-A09", [
    ["22.5.1", "Solo si observa contaminación, proceda con la limpieza; si no, omita estos pasos."],
    ["22.5.2", "Solicite hisopos e isopropanol y humedezca el hisopo."],
    ["22.5.3", "Limpie suavemente ambos conectores Ultrapass y sople con aire ionizado."],
    [23, "Desconecte en la Bianca izquierda el NCSI de BF3 J86 (PN 755-24975-0054-A01), el OSFP sideband L (PN 755-24975-0027-A09) y el sideband de PDB en JSB2 (PN 755-24975-0015-A07)."],
    ["23.1", "Retire el OSFP sideband derecho (PN 755-24975-0003-A08) del CX8 derecho."],
  ]),
  createProcedure(17, "Cableado / energía", "Desconexión de Front Panel y alimentación", "24–25.2", "755-24975-0004-A02 / 755-24975-0047-A01", [
    [24, "Desconecte el cable Front Panel IO (PN 755-24975-0047-A01) del conector FIO IO_CONN."],
    [25, "Retire el cable 12VSSTBY (PN 755-24975-0004-A02) de MB J1 y J13 en las Biancas izquierda y derecha."],
    ["25.1", "Desconecte el cable 12VSSTBY del FIO J1 de la bahía central."],
    ["25.2", "Desconecte el cable 12VSSTBY del PDB J3."],
  ]),
  createProcedure(18, "Cableado / energía", "Desconexión de cables de alimentación PDB", "26–28", "755-24975-0019-A01 / 755-24975-0006-A08 / 755-24975-0015-A07", [
    [26, "Desconecte el cable Multi-End Power Left (PN 755-24975-0019-A01) del PDB J4."],
    [27, "Retire el cable Multi-End Power Middle (PN 755-24975-0006-A08) del PDB J5."],
    [28, "Retire el cable sideband del PDB (PN 755-24975-0015-A07) del conector PDB J15."],
  ]),
  createProcedure(19, "Cableado / energía", "Desconexión de alimentación y cables E1.S", "29–30", "755-24975-0028-A01 / 755-24975-0043-A01 / 755-24975-0042-A01", [
    [29, "Desconecte el cable Multi-End Power Right J6 (PN 755-24975-0028-A01) del PDB J6."],
    [30, "Desconecte los cables E1.S: PN 755-24975-0043-A01 (derecho) y PN 755-24975-0042-A01 (izquierdo), en J11/J12 de la bahía central y J4/J3 de las bahías derecha/izquierda. Siga el ruteo ilustrado."],
  ]),
  createProcedure(20, "Cableado / energía", "Desconexión de sensores y retiro de batería", "31", "755-0117-000 / 755-0108-001 / 755-0118-001 / 756-0150-000", [
    [31, "Desconecte el sensor QD Flex PCB (PN 755-0117-000), Bianca LEAK DETECT (PN 755-0108-001) y Manifold Flex PCB Sensor (PN 755-0118-001); retire la batería (PN 756-0150-000)."],
  ]),
  createProcedure(21, "Chasis", "Retiro de protecciones y bezel trasero", "32–36", "", [
    [32, "Retire el Busbar plástico."],
    [33, "Retire el bracket de protección de la Bianca antes de quitar los tornillos del bezel; vuelva a instalar los brackets después."],
    [34, "Retire los protectores de los conectores naranjas."],
    [35, "Retire el bezel trasero del chasis."],
    [36, "Instale las protecciones de las Cold Plates y de las Biancas."],
  ]),
  createProcedure(22, "Busbar", "Retiro de Busbar con fixture", "37–39", "755-24975-0011-001 / 755-24975-0034-001", [
    [37, "Coloque el fixture FOXMXHRR-2625497 sobre el Busbar; las guías deben entrar en el bezel trasero."],
    [38, "Sostenga el fixture y ajuste los tornillos siguiendo la secuencia ilustrada en la hoja siguiente."],
    [39, "Afloje los tornillos del Busbar en la secuencia indicada con punta T20; torque de ensamble 17.3–17.7 in-lb. Verifique que ningún tornillo quede apretado. Busbar derecho PN 755-24975-0011-001; izquierdo PN 755-24975-0034-001."],
  ]),
  createProcedure(23, "Chasis", "Separación de charola y chasis", "40–41", "", [
    [40, "Instale el soporte Cold Plate y afloje sus tornillos en el orden ilustrado con punta T15. Torque indicado: 4.8–5.3 in-lb."],
    [41, "Afloje el tornillo azul que fija la charola al chasis (4.8–5.3 in-lb, punta PH2) y deslice la charola hacia atrás para separarla. Use ambas manos al manipularla."],
  ]),
  createProcedure(24, "Inspección", "Inspección de conectores, sensores y charola", "42–45", "EQ-32405-34A31A", [
    [42, "Inspeccione los conectores CX8 J16 de ambas Biancas; verifique que no haya pines doblados ni daño en el plástico."],
    [43, "Inspeccione los sensores de las Cold Plates."],
    [44, "Inspeccione J86 y JSB2 en ambas Biancas."],
    [45, "Retire la charola en la esquina marcada de la Bianca. Tornillo PN EQ-32405-34A31A; torque indicado 5.0–5.4 in-lb con punta PH2."],
  ]),
  createProcedure(25, "Bianca", "Retiro de charola, Bianca y Cold Plate", "46–49", "MTB-06-2839 / MTB-07-2839", [
    [46, "Retire la charola del chasis y coloque la placa en el fixture MTB-06-2839."],
    [47, "Use el fixture MTB-07-2839 para retirar los tornillos de la Bianca siguiendo la secuencia ilustrada."],
    [48, "Retire cuidadosamente la Cold Plate jalando su soporte; evite dañar la Bianca."],
    [49, "Desatornille las Biancas izquierda y derecha usando el fixture contramáscara. Torque indicado: 5.0–5.4 in-lb con punta T10; siga la secuencia."],
  ]),
  createProcedure(26, "Bianca", "Desmontaje de Bianca y CX7", "50–51", "CX7-8", [
    [50, "Coloque la Bianca como se muestra y retire la charola del fixture de atornillado."],
    [51, "Use el fixture CX7-8, baje la máscara y desatornille siguiendo las dos secuencias: secuencia 1, punta T15 y 1.35–1.65 in-lb; secuencia 2, punta T15 y 5.0–5.4 in-lb. Coloque los protectores."],
  ]),
  createProcedure(27, "Bianca", "Protección e inspección del módulo CX7", "52–54", "692-24768-0000-000", [
    [52, "Tome el CX7 modelo 2000 (PN 692-24768-0000-000) e instale sus protectores."],
    [53, "Después de retirar el CX8, valide que no haya pines dañados."],
    [54, "Prepare las herramientas y consumibles para limpiar la Bianca y la Cold Plate conforme a los pasos de limpieza."],
  ]),
  createProcedure(28, "Cold Plate / Manifold", "Limpieza de Bianca y Cold Plate", "54.1–54.3", "", [
    ["54.1", "Prepare cepillo, wipes de cuarto limpio, espátula plástica y alcohol. Retire pasta/TIM residual del exterior hacia el centro; evite tocar la superficie de contacto y los capacitores."],
    ["54.2", "Recoja los restos de pasta con el raspador o con las manos, según indica el procedimiento."],
    ["54.3", "Retire todos los thermal pads y deje la superficie sin residuos."],
  ]),
  createProcedure(29, "Cold Plate / Manifold", "Limpieza de orificios y superficies BGA", "54.4–54.5", "", [
    ["54.4", "Use la pistola de aire o succión para limpiar los orificios y retirar residuos."],
    ["54.5", "Humedezca con IPA el cepillo antiestático y limpie suavemente en círculos las superficies BGA de los modelos CX8 y las Biancas; no deje residuos."],
  ]),
  createProcedure(30, "PDB / BMC", "Retiro de PDB y BMC Interpose", "55–57", "699-25859-0311-200 / 688-24975-0008-000", [
    [55, "Retire el módulo PDB del chasis: tornillo 1 con torque 4.8–5.3 in-lb y punta PH2; tornillo 2 con torque 4.8–5.3 in-lb y punta PH1."],
    [56, "Retire el PDB (PN 699-25859-0311-200) de la tarjeta central Cage PCB. Torque indicado: 4.8–5.3 in-lb con punta PH1."],
    [57, "Retire el BMC Interposer (PN 688-24975-0008-000) de la tarjeta central Cage PCB. Torque indicado: 4.8–5.3 in-lb con punta PH2."],
  ]),
  createProcedure(31, "E1.S", "Retiro de SSD y tarjetas E1.S", "58–61.1", "750-0587-000 / 688-24975-0002-001", [
    [58, "Retire los 8 SSD E1.S: 4 unidades PN 750-0587-000 en posiciones 1, 3, 5 y 7; retire los 4 dummy en posiciones 2, 4, 6 y 8. Presione el pestillo y deslícelo. Pestillo PN 1A725B000-600-G, torque 2.3–2.7 in-lb con punta PH1."],
    [59, "Retire los tornillos en el orden indicado para liberar el bracket E1.S. Torque indicado: 4.8–5.3 in-lb con punta PH2."],
    [60, "Retire las dos tarjetas E1.S (PN 688-24975-0002-001), izquierda y derecha."],
    [61, "Libere el pestillo de la bahía central y extráigala suavemente."],
    ["61.1", "Retire los 8 tornillos y el bracket para retirar el frente del chasis de la bahía. Torque indicado: 4.8–5.3 in-lb con punta PH2. Guarde los tornillos y el bracket."],
  ]),
  createProcedure(32, "Chasis", "Retiro de panel frontal y tarjeta FIO", "62–65", "688-24975-0018-000 / 688-24975-0019-000", [
    [62, "Desconecte el cable IO (PN 755-24975-0047-A01) del FIO (PN 688-24975-0018-000) y desatornille el FIO del chasis."],
    [63, "Retire el panel frontal."],
    [64, "Desconecte el cable IO de la tarjeta del panel IO."],
    [65, "Retire la tarjeta del panel IO (PN 688-24975-0019-000). Torque indicado: 2.3–2.7 in-lb con punta PH1."],
  ]),
  createProcedure(33, "Bahías / PCIe", "Retiro de bahía derecha y cables", "66–68", "755-24975-0028-A01", [
    [66, "Valide que todos los cables de la bahía derecha estén desconectados y que los protectores Ultrapass estén instalados."],
    ["66.1", "Presione el pestillo y extraiga la bahía."],
    [67, "Retire los tornillos de la bahía en el orden indicado, con torque 2.3–2.7 in-lb y punta PH2; retire el panel frontal."],
    [68, "Desconecte la alimentación OSFP derecha (PN 755-24975-0028-A01) del BF3 y la alimentación del PCIe riser en el terminal J5."],
  ]),
  createProcedure(34, "Bahías / PCIe", "Preparación del bracket IPEX derecho", "69–71", "WI-HT-G66587A / 692-9D3B6-00CN-PN0", [
    [69, "Desensamble el bracket IPEX retirando sus 4 tornillos (PN WI-HT-G66587A) en orden. Torque indicado: 5.0–5.4 in-lb con punta PH2."],
    [70, "Instale el bracket IPEX en el chasis de la bahía derecha."],
    [71, "Retire los tornillos negros del BF3. Torque indicado: 2.3–2.7 in-lb con punta T6."],
  ]),
  createProcedure(35, "Bahías / PCIe", "Retiro de BF3 y riser PCIe derecho", "72–73", "692-9D3B6-00CN-PN0 / 753-24974-0012-A03", [
    [72, "Desensamble el bracket y el BF3 (PN 692-9D3B6-00CN-PN0); separe el BF3 del PCIe Riser. Torque indicado: 2.3–2.7 in-lb con punta PH2."],
    [73, "Retire del bracket el cable PCIe Riser (PN 753-24974-0012-A03). Torque indicado: 4.8–5.3 in-lb con punta PH2."],
  ]),
  createProcedure(36, "Bahías / PCIe", "Retiro de cables IPEX del BF3 derecho", "74–77", "688-24975-0013-001", [
    [74, "Abra el protector plástico del cable y deslice el conector."],
    [75, "En la tarjeta IPEX (PN 688-24975-0013-001), retire por la parte superior el cable IPEX-BF3 con etiqueta negra; abra suavemente el seguro plástico."],
    [76, "Voltee la tarjeta y retire por la parte inferior el cable con etiqueta blanca."],
    [77, "Abra el protector plástico y deslice el conector para liberarlo."],
  ]),
  createProcedure(37, "Bahías / PCIe", "Retiro de cables IPEX del BF3", "78–79", "692-9D3B6-00CN-PN0", [
    [78, "En la parte superior del BF3 (PN 692-9D3B6-00CN-PN0), retire el cable IPEX con etiqueta negra."],
    [79, "Voltee el BF3 y retire por la parte inferior el cable con etiqueta blanca; use el seguro para liberarlo."],
  ]),
  createProcedure(38, "Bahías / PCIe", "Retiro de tarjeta OSFP derecha", "80–82", "688-24975-0009-002", [
    [80, "Retire el cable de alimentación OSFP derecho de la tarjeta OSFP en PDB JP1 (PN 755-24975-0028-A01)."],
    [81, "Retire el OSFP sideband derecho (PN 755-24975-0003-A08) del conector J1 usando el fixture FOXMXOTR-2620465."],
    [82, "Desatornille y retire la tarjeta OSFP (PN 688-24975-0009-002) del chasis de la bahía derecha. Torque indicado: 4.8–5.3 in-lb con punta PH2."],
  ]),
  createProcedure(39, "Bahías / PCIe", "Retiro de bahía izquierda", "83–84", "755-24975-0019-A01", [
    [83, "Valide que los cables de la bahía izquierda estén completamente desconectados y que los protectores Ultrapass estén instalados."],
    ["83.1", "Libere el pestillo y retire la bahía."],
    ["83.2", "Retire los tornillos de la bahía siguiendo la secuencia, torque 2.3–2.7 in-lb con punta PH2, y retire el panel frontal."],
    [84, "Desconecte la alimentación OSFP izquierda (PN 755-24975-0019-A01) del BF3 y después la alimentación del PCIe riser en el terminal J5."],
  ]),
  createProcedure(40, "Bahías / PCIe", "Desconexión y retiro de BF3 izquierdo", "85–88", "WI-HT-G66587A / 755-24975-0018-A11", [
    [85, "Retire el bracket IPEX quitando sus 4 tornillos (PN WI-HT-G66587A) en la secuencia indicada. Torque: 5.0–5.4 in-lb con punta PH2."],
    [86, "Instale el bracket en el chasis de la bahía derecha, conforme al texto de la hoja."],
    [87, "Desconecte el NCSI del BF3 (PN 755-24975-0018-A11)."],
    [88, "Retire los tornillos negros del BF3. Torque indicado: 2.3–2.7 in-lb con punta T6."],
  ]),
  createProcedure(41, "Bahías / PCIe", "Retiro seguro del cable NCSI de BF3", "89–89.4", "755-24975-0018-A11", [
    [89, "Desconecte el NCSI del BF3 (PN 755-24975-0018-A11); libere el seguro para proteger la tarjeta."],
    ["89.1", "Use el fixture para retirar el cable de forma segura."],
    ["89.2", "Coloque el fixture sin ejercer presión sobre la tarjeta."],
    ["89.3", "Presione el botón superior para liberar el pestillo de la tarjeta."],
    ["89.4", "Retire el cable sin dañar la tarjeta."],
  ]),
  createProcedure(42, "Bahías / PCIe", "Separación de BF3 y riser PCIe izquierdo", "90–91", "692-9D3B6-00CN-PN0 / 753-24974-0012-000", [
    [90, "Desensamble el bracket y el BF3 (PN 692-9D3B6-00CN-PN0), separe el BF3 del PCIe riser. Torque indicado: 2.3–2.7 in-lb con punta PH2."],
    [91, "Retire el cable PCIe riser (PN 753-24974-0012-000). Torque indicado: 4.8–5.3 in-lb con punta PH2."],
  ]),
  createProcedure(43, "Bahías / PCIe", "Retiro de cables IPEX en tarjeta izquierda", "92–95", "", [
    [92, "Abra el protector plástico del cable y deslice el conector."],
    [93, "Retire de la parte superior de la tarjeta IPEX el cable IPEX-BF3 con etiqueta negra; abra suavemente el seguro."],
    [94, "Voltee la tarjeta y retire el cable con etiqueta blanca por la parte inferior."],
    [95, "Abra el protector plástico y deslice el conector para liberarlo."],
  ]),
  createProcedure(44, "Bahías / PCIe", "Retiro de cables IPEX de BF3", "96–97", "", [
    [96, "En la parte superior del BF3, retire el cable IPEX con etiqueta negra."],
    [97, "Voltee el BF3 y retire el cable IPEX con etiqueta blanca de la parte inferior usando el seguro."],
  ]),
  createProcedure(45, "Bahías / PCIe", "Desconexión de OSFP, NIC 1G y alimentación", "98–101", "755-24975-0027-A09 / 755-24975-0044-A01", [
    [98, "Retire el OSFP sideband derecho (PN 755-24975-0027-A09) del conector J1 usando el fixture indicado."],
    [99, "Desconecte el cable MCIO de NIC 1G (PN 755-24975-0044-A01) en J1."],
    [100, "Desconecte el cable OSFP izquierdo (PN 755-24975-0019-A01) de la tarjeta OSFP en PDB JP1."],
    [101, "Desconecte el cable Multi-End Power Left (PN 755-24975-0019-001) del NIC en PDB JP1."],
  ]),
  createProcedure(46, "Bahías / PCIe", "Retiro de NIC y tarjeta OSFP izquierda", "102–103", "688-24975-0012-000 / 688-24975-0009-005", [
    [102, "Retire la NIC (PN 688-24975-0012-000) junto a la OSFP; use torque de 4.8–5.3 in-lb con punta PH2, deslícela hacia atrás y levántela."],
    [103, "Desatornille y retire la OSFP (PN 688-24975-0009-005) del chasis de la bahía izquierda. Torque indicado: 4.8–5.3 in-lb con punta PH2."],
  ]),
];

const DEMO_GROUPS = [
  { procedureId: "sheet-8", sheet: 8, category: "BMC", count: 5, componentPn: "692-13809-2404-000", operation: "Desmontaje de tarjeta BMC y cables MCIO" },
  { procedureId: "sheet-7", sheet: 7, category: "Busbar", count: 6, componentPn: "755-24975-0001-001", operation: "Desmontaje de Busbar y ventiladores" },
  { procedureId: "sheet-9", sheet: 9, category: "Cold Plate / Manifold", count: 6, componentPn: "754-24975-0019-002", operation: "Mangueras y manifolds internos" },
  { procedureId: "sheet-25", sheet: 25, category: "Bianca", count: 2, componentPn: "900-2G548-0001-000", operation: "Retiro de charola, Bianca y Cold Plate" },
];

const DEMO_RECORDS = DEMO_GROUPS.flatMap((group, groupIndex) =>
  Array.from({ length: group.count }, (_, itemIndex) => {
    const sequence = DEMO_GROUPS.slice(0, groupIndex).reduce((sum, item) => sum + item.count, 0) + itemIndex + 1;
    const hour = 8 + Math.floor((sequence + 1) / 3);
    const minute = String((sequence * 13) % 60).padStart(2, "0");
    return {
      id: `demo-${String(sequence).padStart(3, "0")}`,
      category: group.category,
      procedureId: group.procedureId,
      sheet: group.sheet,
      operation: group.operation,
      nodeNumber: `NODO-DEMO-${String(sequence).padStart(3, "0")}`,
      serial: `DEMO-GB200-${String(sequence).padStart(4, "0")}`,
      nodePartNumber: SOP_DOCUMENT.nodePartNumber,
      componentPartNumber: group.componentPn,
      operator: `Operador demo ${String((sequence % 4) + 1).padStart(2, "0")}`,
      employeeNumber: `DEMO-EMP-${String((sequence % 4) + 1).padStart(3, "0")}`,
      position: "Técnico de FA",
      date: TODAY_DATE_KEY,
      displayDate: TODAY_DATE_LABEL,
      time: `${String(hour).padStart(2, "0")}:${minute}`,
      status: "Completado",
      recordType: "Demostración",
    };
  }),
);

const CATEGORY_COLORS = {
  BMC: "#ba1a1a",
  Busbar: "#315b87",
  "Cold Plate / Manifold": "#18814b",
  Bianca: "#d97911",
  Chasis: "#586f86",
  "Cableado / energía": "#8054a4",
  Inspección: "#148b8b",
  "PDB / BMC": "#9a4a34",
  "E1.S": "#23889a",
  "Bahías / PCIe": "#5f6f24",
};

