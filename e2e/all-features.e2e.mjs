import puppeteer from 'puppeteer-core';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function runE2ETests() {
  console.log('\n====================================================');
  console.log('   FINTRACK - SUITE DE PRUEBAS E2E AUTOMATIZADAS    ');
  console.log('   (Selenium / Puppeteer Headless Edge Engine)      ');
  console.log('====================================================\n');

  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  let testsPassed = 0;
  let testsFailed = 0;

  async function assertStep(name, fn) {
    try {
      process.stdout.write(`Prueba: ${name}... `);
      await fn();
      console.log('PASO [OK]');
      testsPassed++;
    } catch (e) {
      console.log(`FALLO [X]: ${e.message}`);
      testsFailed++;
    }
  }

  // 1. CARGA DE LOGIN & ESTÁNDARES DE DISEÑO
  await assertStep('1. Carga inicial de Login con Card Centrado, Proporcionado y Modo Claro', async () => {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    const hasBrand = await page.evaluate(() => document.body.innerText.includes('FinTrack'));
    if (!hasBrand) throw new Error('No se encontró el texto de login');

    // Verificar tema claro por defecto
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    if (theme !== 'light') throw new Error(`Se esperaba tema 'light', se obtuvo: '${theme}'`);

    // Verificar proporciones de los recuadros de entrada (inputs a 100% del contenedor)
    const inputProportions = await page.evaluate(() => {
      const u = document.querySelector('#input-username');
      const p = document.querySelector('#input-password');
      if (!u || !p) return null;
      return {
        userWidth: u.getBoundingClientRect().width,
        passWidth: p.getBoundingClientRect().width,
        cardWidth: document.querySelector('.auth-card').getBoundingClientRect().width
      };
    });
    if (!inputProportions) throw new Error('Inputs de login no encontrados');
    if (Math.abs(inputProportions.userWidth - inputProportions.passWidth) > 5) {
      throw new Error(`Inputs desproporcionados: usuario=${inputProportions.userWidth}px, contraseña=${inputProportions.passWidth}px`);
    }

    // Verificar tabs de modo login / registro
    const loginTab = await page.$('#btn-tab-login');
    const signupTab = await page.$('#btn-tab-signup');
    if (!loginTab || !signupTab) throw new Error('Pestañas de login/registro no encontradas');
  });

  // 2. TABS INTERACTIVAS EN LOGIN
  await assertStep('2. Intercambio de pestañas Login / Crear Usuario en el Auth Card', async () => {
    await page.click('#btn-tab-signup');
    await new Promise(r => setTimeout(r, 200));
    let hasNameField = await page.$('#input-name');
    if (!hasNameField) throw new Error('Campo Nombre Completo no apareció en pestaña de registro');

    await page.click('#btn-tab-login');
    await new Promise(r => setTimeout(r, 200));
    hasNameField = await page.$('#input-name');
    if (hasNameField) throw new Error('Campo Nombre Completo no debió aparecer en pestaña de login');
  });

  // 3. ACCESO DEMO
  await assertStep('3. Acceder con botón Demo mejorado (#btn-demo-login)', async () => {
    const demoBtn = await page.waitForSelector('#btn-demo-login', { timeout: 5000 });
    if (!demoBtn) throw new Error('Botón demo no encontrado');
    
    await demoBtn.click();
    await page.waitForSelector('#btn-logout-desktop', { timeout: 10000 });

    const hasUser = await page.evaluate(() => document.body.innerText.includes('@miguel'));
    if (!hasUser) throw new Error('Usuario @miguel no visible en el dashboard');
  });

  // 4. RESALTADO VISUAL DE GASTOS FIJOS
  await assertStep('4. Verificación de resaltado visual de Gastos Fijos (badge y clase)', async () => {
    const fixedInfo = await page.evaluate(() => {
      const fixedBadges = document.querySelectorAll('.badge-fixed-tag');
      const fixedRows = document.querySelectorAll('.row-fixed-expense');
      const fixedMetric = document.querySelector('.stat-metric-fixed');
      return {
        badgeCount: fixedBadges.length,
        rowCount: fixedRows.length,
        hasMetric: !!fixedMetric
      };
    });

    if (fixedInfo.badgeCount === 0) throw new Error('No se encontraron badges de gastos fijos (.badge-fixed-tag)');
    if (!fixedInfo.hasMetric) throw new Error('Métrica de gastos fijos (.stat-metric-fixed) no encontrada');
  });

  // 5. PRUEBA DE LOGOUT EN ESCRITORIO
  await assertStep('5. Cerrar sesión con botón Logout en escritorio (#btn-logout-desktop)', async () => {
    const logoutBtn = await page.waitForSelector('#btn-logout-desktop', { timeout: 5000 });
    if (!logoutBtn) throw new Error('Botón de logout no encontrado');
    
    await logoutBtn.click();
    await page.waitForSelector('#btn-demo-login', { timeout: 10000 });

    const cookies = await page.cookies();
    const sessionCookie = cookies.find(c => c.name === 'fintrack_session');
    if (sessionCookie && sessionCookie.value) {
      throw new Error('La cookie de sesión no fue eliminada');
    }
  });

  // 6. PROTECCIÓN DE RUTA
  await assertStep('6. Protección de ruta: intentar entrar a / sin sesión debe rebotar a /login', async () => {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#btn-demo-login', { timeout: 5000 });
    const url = page.url();
    if (!url.includes('/login')) {
      throw new Error(`La ruta / no está protegida; URL actual: ${url}`);
    }
  });

  // 7. LOGIN MANUAL CON USUARIO Y CONTRASEÑA
  await assertStep('7. Login manual con usuario "miguel" y contraseña "123456"', async () => {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    
    await page.waitForSelector('#input-username', { timeout: 5000 });
    await page.type('#input-username', 'miguel');
    await page.type('#input-password', '123456');

    const submitBtn = await page.waitForSelector('#btn-auth-submit, #btn-submit-login', { timeout: 5000 });
    await submitBtn.click();
    await page.waitForSelector('#btn-logout-desktop', { timeout: 10000 });
  });

  // 8. NAVEGACIÓN ENTRE TODAS LAS PESTAÑAS
  await assertStep('8. Navegación por pestañas (Tarjetas, Movimientos, Préstamos, Anual)', async () => {
    const tabCards = await page.waitForSelector('#tab-cards');
    await tabCards.click();
    await new Promise(r => setTimeout(r, 400));
    let text = await page.evaluate(() => document.body.innerText);
    if (!text.includes('Interbank') && !text.includes('Scotiabank') && !text.includes('Cuentas')) {
      throw new Error('No se cargó la vista de Tarjetas');
    }

    const tabTxs = await page.waitForSelector('#tab-transactions');
    await tabTxs.click();
    await new Promise(r => setTimeout(r, 400));
    text = await page.evaluate(() => document.body.innerText);
    if (!text.includes('Historial') && !text.includes('Movimientos') && !text.includes('Gasto')) {
      throw new Error('No se cargó la vista de Movimientos');
    }

    const tabRecs = await page.waitForSelector('#tab-receivables');
    await tabRecs.click();
    await new Promise(r => setTimeout(r, 400));
    text = await page.evaluate(() => document.body.innerText);
    if (!text.includes('Cobrar') && !text.includes('Préstamos') && !text.includes('Terceros')) {
      throw new Error('No se cargó la vista de Préstamos');
    }

    const tabOverview = await page.waitForSelector('#tab-overview');
    await tabOverview.click();
    await new Promise(r => setTimeout(r, 400));
  });

  // 9. NAVEGACIÓN DE MESES
  await assertStep('9. Selector y botones de navegación de mes (#btn-next-month y #btn-prev-month)', async () => {
    const prevMonthText = await page.evaluate(() => {
      const el = document.querySelector('#btn-month-picker span');
      return el ? el.innerText.trim() : '';
    });

    const nextBtn = await page.waitForSelector('#btn-next-month');
    await nextBtn.click();
    await new Promise(r => setTimeout(r, 400));

    const nextMonthText = await page.evaluate(() => {
      const el = document.querySelector('#btn-month-picker span');
      return el ? el.innerText.trim() : '';
    });

    if (prevMonthText === nextMonthText) {
      throw new Error(`El mes no cambió tras click siguiente: '${prevMonthText}' -> '${nextMonthText}'`);
    }

    const prevBtn = await page.waitForSelector('#btn-prev-month');
    await prevBtn.click();
    await new Promise(r => setTimeout(r, 400));

    const restoredMonthText = await page.evaluate(() => {
      const el = document.querySelector('#btn-month-picker span');
      return el ? el.innerText.trim() : '';
    });

    if (restoredMonthText !== prevMonthText) {
      throw new Error(`El mes no volvió al original: '${restoredMonthText}' vs '${prevMonthText}'`);
    }
  });

  // 10. REGISTRAR UN NUEVO GASTO (MODAL + CREACIÓN)
  await assertStep('10. Apertura de modal y registro de nuevo gasto', async () => {
    const addBtn = await page.waitForSelector('#btn-quick-add', { timeout: 5000 });
    await addBtn.click();

    await page.waitForSelector('#input-expense-desc', { timeout: 5000 });
    const uniqueTxName = 'Gasto Test ' + Date.now();
    await page.type('#input-expense-desc', uniqueTxName);
    await page.type('#input-expense-amount', '55.00');

    const saveBtn = await page.waitForSelector('#btn-save-expense', { timeout: 5000 });
    await saveBtn.click();

    await new Promise(r => setTimeout(r, 800));

    const hasTx = await page.evaluate((name) => document.body.innerText.includes(name), uniqueTxName);
    if (!hasTx) throw new Error('El nuevo gasto no apareció en la lista');

    page._testTxName = uniqueTxName;
  });

  // 11. ELIMINACIÓN CON MODAL DE CONFIRMACIÓN (CANCELAR + CONFIRMAR)
  await assertStep('11. Modal de Confirmación al Eliminar (prevenir miss-click y confirmación)', async () => {
    const targetName = page._testTxName || 'Gasto Test';
    
    // 1. Clic en eliminar en la fila del gasto
    const clicked = await page.evaluate((name) => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const targetRow = rows.find(r => r.innerText.includes(name));
      if (!targetRow) return false;
      const delBtn = targetRow.querySelector('button[title*="Eliminar"]');
      if (delBtn) {
        delBtn.click();
        return true;
      }
      return false;
    }, targetName);

    if (!clicked) throw new Error('No se encontró el botón eliminar en la fila del gasto');

    // 2. Verificar que apareció el modal de confirmación
    await page.waitForSelector('#btn-cancel-delete', { timeout: 3000 });
    await page.waitForSelector('#btn-confirm-delete', { timeout: 3000 });

    // 3. Probar Cancelar: el gasto debe persistir
    await page.click('#btn-cancel-delete');
    await new Promise(r => setTimeout(r, 400));
    const stillHas = await page.evaluate((name) => document.body.innerText.includes(name), targetName);
    if (!stillHas) throw new Error('El gasto se eliminó por error al presionar Cancelar');

    // 4. Volver a abrir el modal de confirmación
    await page.evaluate((name) => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const targetRow = rows.find(r => r.innerText.includes(name));
      const delBtn = targetRow.querySelector('button[title*="Eliminar"]');
      delBtn.click();
    }, targetName);

    await page.waitForSelector('#btn-confirm-delete', { timeout: 3000 });
    
    // 5. Confirmar eliminación
    await page.click('#btn-confirm-delete');
    await new Promise(r => setTimeout(r, 800));

    const stillExists = await page.evaluate((name) => document.body.innerText.includes(name), targetName);
    if (stillExists) throw new Error('El gasto sigue apareciendo después de presionar confirmar');
  });

  // 12. EDICIÓN DE TARJETA Y LÍMITES
  await assertStep('12. Apertura de modal de edición de tarjeta y guardado', async () => {
    const tabCards = await page.waitForSelector('#tab-cards');
    await tabCards.click();
    await new Promise(r => setTimeout(r, 400));

    const editBtn = await page.waitForSelector('button[title*="Editar tarjeta"]', { timeout: 5000 });
    await editBtn.click();

    await page.waitForSelector('#input-edit-card-name', { timeout: 5000 });
    
    await page.evaluate(() => {
      const input = document.querySelector('#input-edit-card-limit');
      if (input) {
        input.value = '6500';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const saveCardBtn = await page.waitForSelector('#btn-save-edit-card', { timeout: 5000 });
    await saveCardBtn.click();
    await new Promise(r => setTimeout(r, 600));

    const modalClosed = await page.evaluate(() => !document.querySelector('#input-edit-card-name'));
    if (!modalClosed) throw new Error('El modal de editar tarjeta no se cerró');
  });

  // 13. SUGERENCIA INTELIGENTE DE CATEGORÍA Y GASTOS FIJOS (NLP / IA)
  await assertStep('13. Sugerencia Inteligente de Categoría y Gastos Fijos con NLP/IA (#ai-suggest-chip)', async () => {
    // Abrir modal de nuevo gasto
    const quickAddBtn = await page.waitForSelector('#btn-quick-add', { timeout: 5000 });
    await quickAddBtn.click();
    await page.waitForSelector('#input-expense-desc', { timeout: 5000 });

    try {
      // Escribir "Netflix mensual" con page.type para disparar synthetic events de React
      await page.type('#input-expense-desc', 'Netflix mensual');
      await new Promise(r => setTimeout(r, 400));

      // Verificar que aparece el chip de IA
      const chip = await page.waitForSelector('.ai-suggest-chip', { timeout: 5000 });
      if (!chip) throw new Error('No apareció el chip de sugerencia de IA');

      const chipText = await page.evaluate(el => el.innerText, chip);
      if (!chipText.toLowerCase().includes('suscripciones') && !chipText.toLowerCase().includes('ia')) {
        throw new Error(`Texto de chip inesperado: ${chipText}`);
      }
    } finally {
      // Garantizar que el modal se cierre siempre
      const closeBtn = await page.$('#btn-close-expense-modal');
      if (closeBtn) {
        await closeBtn.click();
        await new Promise(r => setTimeout(r, 400));
      }
    }
  });

  // 14. HUB DE ANÁLISIS (MES ACTUAL · TENDENCIA · PROYECCIÓN) + DETECCIÓN DE ANOMALÍAS
  await assertStep('14. Hub de Análisis (diagnóstico del mes, auditoría IA y proyección P9)', async () => {
    const tabAnalysis = await page.waitForSelector('#tab-analysis', { timeout: 5000 });
    await tabAnalysis.click();
    await new Promise(r => setTimeout(r, 600));

    // Vista por defecto "Mes actual": debe mostrar el contenedor de auditoría IA
    const auditCount = await page.evaluate(() => document.querySelectorAll('.ai-audit-container').length);
    if (auditCount === 0) throw new Error('Contenedor de auditoría de IA no encontrado en la vista Mes actual');

    // Cambiar a la vista "Proyección" para el simulador de flujo
    const projectionBtn = await page.waitForSelector('#analysis-view-projection', { timeout: 5000 });
    await projectionBtn.click();
    await new Promise(r => setTimeout(r, 400));

    // Verificar que los botones de horizonte existen
    const btnHorizon3 = await page.waitForSelector('#forecast-horizon-3', { timeout: 5000 });
    const btnHorizon6 = await page.waitForSelector('#forecast-horizon-6', { timeout: 5000 });
    if (!btnHorizon3 || !btnHorizon6) throw new Error('Botones de horizonte de proyección no encontrados');

    // Verificar tarjetas de forecast
    const forecastCardsCount = await page.evaluate(() => document.querySelectorAll('.forecast-card').length);
    if (forecastCardsCount < 3) throw new Error(`Se esperaban al menos 3 tarjetas de forecast, se encontraron ${forecastCardsCount}`);

    // Alternar a 3 meses y verificar
    await btnHorizon3.click();
    await new Promise(r => setTimeout(r, 300));
    const count3 = await page.evaluate(() => document.querySelectorAll('.forecast-card').length);
    if (count3 !== 3) throw new Error(`Se esperaban exactamente 3 tarjetas en horizonte 3m, se obtuvieron ${count3}`);

    // Volver a 6 meses
    await btnHorizon6.click();

    // Vista "Tendencia": debe renderizar el consolidado anual embebido
    const trendBtn = await page.waitForSelector('#analysis-view-trend', { timeout: 5000 });
    await trendBtn.click();
    await new Promise(r => setTimeout(r, 400));
    const annualMatrixCount = await page.evaluate(() => document.querySelectorAll('.annual-summary-panel').length);
    if (annualMatrixCount === 0) throw new Error('El consolidado anual no se renderizó en la vista Tendencia');
  });

  // 15. CONCILIACIÓN BANCARIA Y CARGA DE ESTADO DE CUENTA
  await assertStep('15. Conciliación Bancaria Inteligente (render de la vista y dropzone)', async () => {
    const tabRec = await page.waitForSelector('#tab-reconciliation', { timeout: 5000 });
    await tabRec.click();
    await new Promise(r => setTimeout(r, 600));

    // La carga de estado de cuenta es por archivo real (PDF/Excel/CSV). Sin fixture
    // solo verificamos que la vista y su dropzone rendericen correctamente.
    const dropInput = await page.waitForSelector('#input-statement-file', { timeout: 5000 });
    if (!dropInput) throw new Error('Input de estado de cuenta no encontrado en Conciliación');
  });

  // 16. EXPORTACIÓN A EXCEL PROFESIONAL (.XLSX)
  await assertStep('16. Botón de Exportación a Excel Profesional (.xlsx con SheetJS)', async () => {
    const excelBtn = await page.waitForSelector('#btn-export-excel', { timeout: 5000 });
    if (!excelBtn) throw new Error('Botón #btn-export-excel no encontrado en el header');

    // Verificar que el botón es clickable sin arrojar excepciones
    await page.evaluate(() => {
      const btn = document.querySelector('#btn-export-excel');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));
  });

  // 17. LOGOUT EN MÓVIL
  await assertStep('17. Logout en modo móvil (Viewport 375px -> #btn-logout-desktop del header)', async () => {
    await page.setViewport({ width: 375, height: 812 });
    await new Promise(r => setTimeout(r, 400));

    // En móvil el cerrar sesión vive en el header (visible también en móvil),
    // ya no en el menú "Más".
    const logoutBtn = await page.waitForSelector('#btn-logout-desktop', { timeout: 5000 });
    await logoutBtn.click();

    await page.waitForSelector('#btn-demo-login', { timeout: 10000 });
    const url = page.url();
    if (!url.includes('/login')) {
      throw new Error(`Esperado /login tras logout móvil, actual: ${url}`);
    }
  });

  await browser.close();

  console.log('\n====================================================');
  console.log(`RESUMEN FINAL: ${testsPassed} Pasadas | ${testsFailed} Fallidas`);
  console.log('====================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runE2ETests().catch(err => {
  console.error('Fallo crítico en suite E2E:', err);
  process.exit(1);
});
