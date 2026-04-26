import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import styles from './FinanzasView.module.css';

type Period   = 'mes' | 'trimestre' | 'año';
type TxType   = 'income' | 'expense';
type TxStatus = 'paid' | 'pending';

interface Transaction { id:string; date:string; description:string; category:string; type:TxType; amount:number; status:TxStatus; }
interface BudgetItem  { category:string; budget:number; actual:number; }
interface ClientProfit { name:string; revenue:number; costs:number; projects:number; }
interface HourEntry { id:string; employee:string; project:string; date:string; hours:number; description:string; rate:number; billable:boolean; }

type Detail =
  | { kind:'kpi'; id:'ingresos'|'gastos'|'balance'|'cobrar'|'mrr' }
  | { kind:'aging';    i:number }
  | { kind:'budget';   i:number }
  | { kind:'client';   i:number }
  | { kind:'month';    i:number }
  | { kind:'category'; i:number };

/* ── Initial data ───────────────────────────────────────────────── */
const INITIAL_TRANSACTIONS: Transaction[] = [
  { id:'1',  date:'2026-04-03', description:'Proyecto Branding Fontana',  category:'Cobro cliente',   type:'income',  amount:18500, status:'paid'    },
  { id:'2',  date:'2026-04-02', description:'Suscripción Figma',           category:'Software',        type:'expense', amount:150,   status:'paid'    },
  { id:'3',  date:'2026-04-01', description:'Proyecto UI App Fintech',     category:'Cobro cliente',   type:'income',  amount:24000, status:'paid'    },
  { id:'4',  date:'2026-03-31', description:'Sueldos marzo',               category:'Sueldos',         type:'expense', amount:28000, status:'paid'    },
  { id:'5',  date:'2026-03-28', description:'Adobe Creative Cloud',        category:'Software',        type:'expense', amount:620,   status:'paid'    },
  { id:'6',  date:'2026-03-25', description:'Proyecto Packaging Cerveza',  category:'Cobro cliente',   type:'income',  amount:9800,  status:'pending' },
  { id:'7',  date:'2026-03-22', description:'Alquiler oficina',            category:'Infraestructura', type:'expense', amount:3200,  status:'paid'    },
  { id:'8',  date:'2026-03-20', description:'Proyecto Identidad Visual',   category:'Cobro cliente',   type:'income',  amount:14200, status:'paid'    },
  { id:'9',  date:'2026-03-18', description:'Campaña Google Ads',          category:'Marketing',       type:'expense', amount:1800,  status:'paid'    },
  { id:'10', date:'2026-03-15', description:'Proyecto E-commerce App',     category:'Cobro cliente',   type:'income',  amount:32000, status:'pending' },
  { id:'11', date:'2026-03-12', description:'Notion Teams',                category:'Software',        type:'expense', amount:96,    status:'paid'    },
  { id:'12', date:'2026-03-08', description:'Equipamiento pantalla',       category:'Equipamiento',    type:'expense', amount:4800,  status:'paid'    },
];

const INITIAL_BUDGET: BudgetItem[] = [
  { category:'Sueldos',         budget:30000, actual:28000 },
  { category:'Software',        budget:8000,  actual:4820  },
  { category:'Infraestructura', budget:3500,  actual:3200  },
  { category:'Marketing',       budget:3000,  actual:1800  },
  { category:'Equipamiento',    budget:5000,  actual:4800  },
];

const MONTHLY_DATA = [
  { month:'Nov', income:58000, expense:36000 },
  { month:'Dic', income:71000, expense:41000 },
  { month:'Ene', income:64000, expense:38500 },
  { month:'Feb', income:79000, expense:43000 },
  { month:'Mar', income:88500, expense:45200 },
  { month:'Abr', income:42500, expense:18700 },
];

const CASH_PROJECTION = [
  { month:'Ene', value:26500, projected:false },
  { month:'Feb', value:37000, projected:false },
  { month:'Mar', value:44300, projected:false },
  { month:'Abr', value:23800, projected:false },
  { month:'May', value:38500, projected:true  },
  { month:'Jun', value:41200, projected:true  },
  { month:'Jul', value:45800, projected:true  },
];

const CLIENT_PROFIT: ClientProfit[] = [
  { name:'Fontana Agency',   revenue:32000, costs:11200, projects:3 },
  { name:'Fintech Startup',  revenue:24000, costs:9600,  projects:2 },
  { name:'E-commerce Brand', revenue:18500, costs:8325,  projects:2 },
  { name:'Packaging Co.',    revenue:9800,  costs:5880,  projects:1 },
  { name:'Local Restaurant', revenue:6400,  costs:4480,  projects:1 },
];

const MRR = 14400;

const AGING = [
  { label:'0 – 30 días',  count:3, amount:28300, color:'#34D399', bg:'rgba(52,211,153,0.1)'   },
  { label:'31 – 60 días', count:1, amount:9800,  color:'#F5C842', bg:'rgba(245,200,66,0.1)'   },
  { label:'61 – 90 días', count:1, amount:5200,  color:'#FB923C', bg:'rgba(251,146,60,0.1)'   },
  { label:'+90 días',     count:0, amount:0,      color:'#F87171', bg:'rgba(248,113,113,0.08)' },
];

const AGING_INVOICES = [
  [
    { client:'Fintech Startup',  amount:24000, issued:'2026-04-01', due:'2026-05-01', days:30 },
    { client:'Fontana Agency',   amount:3800,  issued:'2026-04-03', due:'2026-05-03', days:30 },
    { client:'Diseñadora Local', amount:500,   issued:'2026-04-04', due:'2026-05-04', days:30 },
  ],
  [{ client:'Packaging Co.',    amount:9800,  issued:'2026-03-04', due:'2026-04-03', days:1  }],
  [{ client:'E-commerce Brand', amount:5200,  issued:'2026-02-04', due:'2026-03-05', days:30 }],
  [],
];

const CLIENT_PROJECTS = [
  [
    { name:'Branding Fontana',  amount:18500, status:'paid',    date:'2026-04-03' },
    { name:'Identidad sistema', amount:8500,  status:'paid',    date:'2026-03-15' },
    { name:'Manual de marca',   amount:5000,  status:'pending', date:'2026-04-30' },
  ],
  [
    { name:'UI App Fintech',    amount:24000, status:'paid',    date:'2026-04-01' },
    { name:'Design system',     amount:14000, status:'pending', date:'2026-05-15' },
  ],
  [
    { name:'E-commerce App',    amount:32000, status:'pending', date:'2026-05-15' },
    { name:'App móvil UX',      amount:8500,  status:'pending', date:'2026-06-01' },
  ],
  [{ name:'Packaging Cerveza',  amount:9800,  status:'pending', date:'2026-04-25' }],
  [{ name:'Identidad Visual',   amount:6400,  status:'paid',    date:'2026-03-20' }],
];

const EMPLOYEES = ['Valeria Ríos','Mateo Schultz','Lara Fontana','Bruno Herrera','Agustín López'];
const PROJECTS_LIST = ['Branding Fontana','UI App Fintech','E-commerce App','Packaging Cerveza','Identidad Visual','Design system'];

const INITIAL_HOURS: HourEntry[] = [
  { id:'h1',  employee:'Valeria Ríos',    project:'Branding Fontana',   date:'2026-04-03', hours:6,   description:'Presentación de marca',         rate:8500, billable:true  },
  { id:'h2',  employee:'Mateo Schultz',   project:'UI App Fintech',      date:'2026-04-03', hours:7.5, description:'Componentes dashboard',         rate:7200, billable:true  },
  { id:'h3',  employee:'Lara Fontana',    project:'E-commerce App',      date:'2026-04-02', hours:5,   description:'UX research y wireframes',      rate:7800, billable:true  },
  { id:'h4',  employee:'Bruno Herrera',   project:'Design system',       date:'2026-04-02', hours:8,   description:'Tokens y documentación',        rate:6500, billable:false },
  { id:'h5',  employee:'Agustín López',   project:'Packaging Cerveza',   date:'2026-04-01', hours:4,   description:'Revisión y ajustes finales',    rate:6000, billable:true  },
  { id:'h6',  employee:'Valeria Ríos',    project:'Identidad Visual',    date:'2026-04-01', hours:3.5, description:'Guía de uso de marca',          rate:8500, billable:true  },
  { id:'h7',  employee:'Mateo Schultz',   project:'UI App Fintech',      date:'2026-03-31', hours:6,   description:'Prototipo interactivo',         rate:7200, billable:true  },
  { id:'h8',  employee:'Lara Fontana',    project:'Branding Fontana',    date:'2026-03-31', hours:4.5, description:'Concepto visual y paleta',      rate:7800, billable:true  },
  { id:'h9',  employee:'Bruno Herrera',   project:'E-commerce App',      date:'2026-03-28', hours:7,   description:'Arquitectura de información',   rate:6500, billable:true  },
  { id:'h10', employee:'Agustín López',   project:'Design system',       date:'2026-03-28', hours:5,   description:'Reunión interna de alineación', rate:6000, billable:false },
  { id:'h11', employee:'Valeria Ríos',    project:'UI App Fintech',      date:'2026-03-25', hours:8,   description:'Diseño de pantallas clave',     rate:8500, billable:true  },
  { id:'h12', employee:'Mateo Schultz',   project:'Packaging Cerveza',   date:'2026-03-22', hours:3,   description:'Bocetos y variantes',           rate:7200, billable:true  },
];

const EMPTY_HOUR = { employee:'', project:'', date:new Date().toISOString().split('T')[0], hours:'', description:'', rate:'', billable:true };

const MRR_CLIENTS = [
  { name:'Fontana Agency', amount:6000, since:'ene 2025' },
  { name:'TechCorp',       amount:5400, since:'mar 2025' },
  { name:'Studio Local',   amount:3000, since:'jun 2025' },
];

const PENDING_INVOICES = [
  { client:'E-commerce Brand', amount:32000, due:'2026-04-10', urgency:'overdue' as const },
  { client:'Packaging Co.',    amount:9800,  due:'2026-04-25', urgency:'soon'    as const },
  { client:'Fintech Startup',  amount:1500,  due:'2026-04-30', urgency:'ok'      as const },
];

const CAT_COLORS: Record<string,string> = {
  'Sueldos':'#9580FF','Software':'#7C5CFC','Infraestructura':'#B8A8FF',
  'Marketing':'#F5C842','Equipamiento':'#22D3EE','Impuestos':'#FB923C',
  'Cobro cliente':'#34D399','Retainer':'#A690FF','Consultoría':'#34D399','Otro':'#6B7280',
};

const INCOME_CATS  = ['Cobro cliente','Retainer','Consultoría','Subsidio','Otro ingreso'];
const EXPENSE_CATS = ['Sueldos','Software','Infraestructura','Marketing','Equipamiento','Impuestos','Otro gasto'];

const EMPTY_TX = { type:'income' as TxType, description:'', category:'', amount:'', date:new Date().toISOString().split('T')[0], status:'paid' as TxStatus };

/* ── Helpers ────────────────────────────────────────────────────── */
const fmt     = (n:number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits:0 });
const fmtDate = (iso:string) => new Date(iso+'T00:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short' });

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
export default function FinanzasView() {
  const [period,   setPeriod]   = useState<Period>('mes');
  const [txFilter, setTxFilter] = useState<'all'|TxType>('all');
  const [detail,   setDetail]   = useState<Detail|null>(null);
  const [view,     setView]     = useState<'resumen'|'horas'>('resumen');

  /* Live data */
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [budget,       setBudget]       = useState<BudgetItem[]>(INITIAL_BUDGET);
  const [hours,        setHours]        = useState<HourEntry[]>(INITIAL_HOURS);

  /* Form modals */
  const [showNewTx,      setShowNewTx]      = useState(false);
  const [showEditBudget, setShowEditBudget] = useState(false);
  const [showNewHour,      setShowNewHour]      = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string|null>(null);
  const [newTx,          setNewTx]          = useState({ ...EMPTY_TX });
  const [newHour,        setNewHour]        = useState({ ...EMPTY_HOUR });
  const [editBudget,     setEditBudget]     = useState<BudgetItem[]>([]);
  const [txError,        setTxError]        = useState('');
  const [hourError,      setHourError]      = useState('');

  const open  = (d:Detail) => setDetail(d);
  const close = () => setDetail(null);

  /* ── Period filter helper ── */
  const now = new Date();
  const inPeriod = (iso: string): boolean => {
    const d = new Date(iso + 'T00:00:00');
    if (period === 'mes') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (period === 'trimestre') {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return d >= start && d <= end;
    }
    // año
    return d.getFullYear() === now.getFullYear();
  };

  /* ── Computed KPIs from live transactions ── */
  const periodTxs = transactions.filter(t => inPeriod(t.date));

  const ingresos  = periodTxs.filter(t => t.type==='income'  && t.status==='paid').reduce((s,t)=>s+t.amount,0);
  const gastos    = periodTxs.filter(t => t.type==='expense'                     ).reduce((s,t)=>s+t.amount,0);
  const balance   = ingresos - gastos;
  const porCobrar = periodTxs.filter(t => t.type==='income' && t.status==='pending').reduce((s,t)=>s+t.amount,0);

  /* ── Computed expense categories ── */
  const expenseTotals = periodTxs.filter(t => t.type==='expense').reduce((acc,t) => {
    acc[t.category] = (acc[t.category]||0) + t.amount;
    return acc;
  }, {} as Record<string,number>);

  const categories = Object.entries(expenseTotals)
    .map(([name,amount]) => ({ name, amount, color: CAT_COLORS[name]||'#9580FF' }))
    .sort((a,b) => b.amount - a.amount);

  /* ── Budget actual from transactions ── */
  const liveBudget = budget.map(b => ({
    ...b,
    actual: periodTxs.filter(t => t.type==='expense' && t.category===b.category).reduce((s,t)=>s+t.amount,0),
  }));

  /* ── Budget transactions by category index ── */
  const budgetTxs = (i:number) => periodTxs.filter(t => t.type==='expense' && t.category===liveBudget[i]?.category);

  const txs = periodTxs.filter(t => txFilter==='all' || t.type===txFilter)
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  /* ── Add transaction ── */
  const handleAddTx = () => {
    if (!newTx.description.trim()) { setTxError('Agregá una descripción.'); return; }
    if (!newTx.category)           { setTxError('Seleccioná una categoría.'); return; }
    const amt = parseFloat(newTx.amount.replace(/[^0-9.]/g,''));
    if (!amt || amt <= 0)          { setTxError('Ingresá un monto válido.'); return; }
    setTxError('');
    setTransactions(prev => [...prev, {
      id: Date.now().toString(),
      date: newTx.date, description: newTx.description,
      category: newTx.category, type: newTx.type,
      amount: amt, status: newTx.status,
    }]);
    setShowNewTx(false);
    setNewTx({ ...EMPTY_TX });
  };

  /* ── Save budgets ── */
  const handleSaveBudget = () => {
    setBudget(editBudget);
    setShowEditBudget(false);
  };

  /* ── Add hour entry ── */
  const handleAddHour = () => {
    if (!newHour.employee)          { setHourError('Seleccioná un empleado.'); return; }
    if (!newHour.project)           { setHourError('Seleccioná un proyecto.'); return; }
    const hrs = parseFloat(String(newHour.hours));
    if (!hrs || hrs <= 0)           { setHourError('Ingresá las horas trabajadas.'); return; }
    const rate = parseFloat(String(newHour.rate).replace(/[^0-9.]/g,''));
    if (!rate || rate <= 0)         { setHourError('Ingresá la tarifa por hora.'); return; }
    setHourError('');
    setHours(prev => [...prev, {
      id: Date.now().toString(),
      employee: newHour.employee, project: newHour.project,
      date: newHour.date, hours: hrs, description: newHour.description,
      rate, billable: newHour.billable,
    }]);
    setShowNewHour(false);
    setNewHour({ ...EMPTY_HOUR });
  };

  /* ── Hour KPIs ── */
  const periodHours    = hours.filter(h => inPeriod(h.date));
  const workingDays    = period === 'mes' ? 22 : period === 'trimestre' ? 66 : 261;
  const totalHours     = periodHours.reduce((s,h) => s + h.hours, 0);
  const billableHours  = periodHours.filter(h => h.billable).reduce((s,h) => s + h.hours, 0);
  const totalCost      = periodHours.reduce((s,h) => s + h.hours * h.rate, 0);
  const avgDaily       = totalHours / workingDays;

  /* Bar chart */
  const BAR_W=28, GAP=6, GROUP_W=BAR_W*2+GAP+20, CHART_H=140;
  const maxBarVal = Math.max(...MONTHLY_DATA.map(d=>Math.max(d.income,d.expense)));

  /* Cash projection */
  const PROJ_W=500, PROJ_H=130, PAD=16;
  const vals=CASH_PROJECTION.map(d=>d.value);
  const minV=Math.min(...vals)*0.9, maxV=Math.max(...vals)*1.05;
  const px=(i:number)=>(i/(CASH_PROJECTION.length-1))*(PROJ_W-PAD*2)+PAD;
  const py=(v:number)=>PAD+(1-(v-minV)/(maxV-minV))*(PROJ_H-PAD*2);
  const actualPts=CASH_PROJECTION.filter(d=>!d.projected);
  const projPts=CASH_PROJECTION.filter((_,i)=>i>=actualPts.length-1);
  const projBase=actualPts.length-1;
  const pPath=(pts:typeof CASH_PROJECTION,off=0)=>pts.map((d,i)=>`${i===0?'M':'L'} ${px(i+off)} ${py(d.value)}`).join(' ');
  const areaPath=actualPts.map((d,i)=>`${i===0?'M':'L'} ${px(i)} ${py(d.value)}`).join(' ')
    +` L ${px(actualPts.length-1)} ${PROJ_H} L ${PAD} ${PROJ_H} Z`;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Finanzas</h2>
          <p className={styles.subtitle}>Resumen económico de la empresa</p>
          <div className={styles.viewTabs}>
            <button className={[styles.viewTab,view==='resumen'?styles.viewTabActive:''].join(' ')} onClick={()=>setView('resumen')}>
              <i className="ri-line-chart-line"/> Resumen
            </button>
            <button className={[styles.viewTab,view==='horas'?styles.viewTabActive:''].join(' ')} onClick={()=>setView('horas')}>
              <i className="ri-time-line"/> Horas
            </button>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.periodTabs}>
            {(['mes','trimestre','año'] as Period[]).map(p => (
              <button key={p} className={[styles.periodTab,period===p?styles.periodTabActive:''].join(' ')} onClick={()=>setPeriod(p)}>
                {p.charAt(0).toUpperCase()+p.slice(1)}
              </button>
            ))}
          </div>
          {view === 'resumen'
            ? <button className={styles.newTxBtn} onClick={()=>{ setNewTx({...EMPTY_TX}); setTxError(''); setShowNewTx(true); }}>
                <i className="ri-add-line" /> Nuevo movimiento
              </button>
            : <button className={styles.newTxBtn} onClick={()=>{ setNewHour({...EMPTY_HOUR}); setHourError(''); setShowNewHour(true); }}>
                <i className="ri-add-line" /> Registrar horas
              </button>
          }
        </div>
      </div>

      <div className={styles.body}>
      {view === 'horas' ? (
        <>
          {/* Hours KPIs */}
          <div className={styles.kpiRow} style={{gridTemplateColumns:'repeat(4,1fr)'}}>
            <KpiCard icon="ri-time-line"          label="Total horas"       value={`${totalHours.toFixed(1)}h`}   delta={`${hours.length} registros`}    positive muted onClick={()=>{}} />
            <KpiCard icon="ri-money-dollar-circle-line" label="Horas facturables" value={`${billableHours.toFixed(1)}h`} delta={`${totalHours>0?((billableHours/totalHours)*100).toFixed(0):0}% facturable`} positive onClick={()=>{}} />
            <KpiCard icon="ri-coin-line"          label="Costo total"       value={fmt(totalCost)}                delta="horas × tarifa"                 positive={false} muted onClick={()=>{}} />
            <KpiCard icon="ri-calendar-check-line" label="Promedio diario"  value={`${avgDaily.toFixed(1)}h`}     delta={`/${workingDays} días hábiles`}  positive muted onClick={()=>{}} />
          </div>

          {/* Hours table */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Registro de horas</span>
              <span className={styles.cardSubtitle}>{periodHours.length} entradas</span>
            </div>
            <table className={styles.hoursTable}>
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Proyecto</th>
                  <th>Fecha</th>
                  <th className={styles.numCol}>Horas</th>
                  <th>Descripción</th>
                  <th className={styles.numCol}>Tarifa/h</th>
                  <th className={styles.numCol}>Total</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {[...periodHours].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map(h=>(
                  <tr key={h.id} className={styles.hoursRow}>
                    <td>
                      <div className={[styles.hoursEmployee,styles.clickable].join(' ')} onClick={()=>setSelectedEmployee(h.employee)}>
                        <div className={styles.hoursAvatar}>{h.employee.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
                        <span className={[styles.hoursEmployeeName,styles.hoursEmployeeLink].join(' ')}>{h.employee}</span>
                      </div>
                    </td>
                    <td><span className={styles.hoursProject}>{h.project}</span></td>
                    <td className={styles.hoursDate}>{fmtDate(h.date)}</td>
                    <td className={[styles.hoursHrsCol,styles.numCol].join(' ')}>{h.hours}h</td>
                    <td className={styles.hoursDesc}>{h.description || '—'}</td>
                    <td className={styles.numCol}><span className={styles.hoursRate}>{fmt(h.rate)}</span></td>
                    <td className={styles.numCol}><span className={styles.hoursTotal}>{fmt(h.hours * h.rate)}</span></td>
                    <td><span className={[styles.hoursBadge,h.billable?styles.hoursBillable:styles.hoursInternal].join(' ')}>{h.billable?'Facturable':'Interno'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
        {/* KPIs */}
        <div className={styles.kpiRow}>
          <KpiCard icon="ri-arrow-up-circle-line"   label="Ingresos del mes" value={fmt(ingresos)}  delta="+12%" positive onClick={()=>open({kind:'kpi',id:'ingresos'})} />
          <KpiCard icon="ri-arrow-down-circle-line" label="Gastos del mes"   value={fmt(gastos)}    delta="-5%"  positive onClick={()=>open({kind:'kpi',id:'gastos'})} />
          <KpiCard icon="ri-scales-line"            label="Balance neto"     value={fmt(balance)}   delta={ingresos>0?`${((balance/ingresos)*100).toFixed(0)}% margen`:'—'} positive accent onClick={()=>open({kind:'kpi',id:'balance'})} />
          <KpiCard icon="ri-time-line"              label="Por cobrar"       value={fmt(porCobrar)} delta={`${transactions.filter(t=>t.type==='income'&&t.status==='pending').length} facturas`} positive={false} muted onClick={()=>open({kind:'kpi',id:'cobrar'})} />
          <KpiCard icon="ri-repeat-line"            label="MRR (retainers)"  value={fmt(MRR)}       delta="+3 clientes" positive onClick={()=>open({kind:'kpi',id:'mrr'})} />
        </div>

        {/* Bar chart + Categories */}
        <div className={styles.middleRow}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Ingresos vs Gastos</span>
              <div className={styles.chartLegend}>
                <span className={styles.legendDot} style={{background:'var(--color-primary)'}}/><span className={styles.legendLabel}>Ingresos</span>
                <span className={styles.legendDot} style={{background:'#F87171'}}/><span className={styles.legendLabel}>Gastos</span>
              </div>
            </div>
            <div className={styles.barChartWrap}>
              <svg width={MONTHLY_DATA.length*GROUP_W+8} height={CHART_H+32} className={styles.barChart}>
                {[0.25,0.5,0.75,1].map(f=>(
                  <line key={f} x1={0} y1={CHART_H-f*CHART_H} x2={MONTHLY_DATA.length*GROUP_W+8} y2={CHART_H-f*CHART_H} stroke="var(--color-border-light)" strokeWidth={1}/>
                ))}
                {MONTHLY_DATA.map((d,i)=>{
                  const x=i*GROUP_W+4, ih=(d.income/maxBarVal)*CHART_H, eh=(d.expense/maxBarVal)*CHART_H, last=i===MONTHLY_DATA.length-1;
                  return (
                    <g key={d.month} className={styles.barGroup} onClick={()=>open({kind:'month',i})}>
                      <rect x={x} y={0} width={BAR_W*2+GAP} height={CHART_H} fill="transparent"/>
                      <rect x={x}        y={CHART_H-ih} width={BAR_W} height={ih} rx={4} fill="var(--color-primary)" opacity={last?1:0.5}/>
                      <rect x={x+BAR_W+GAP} y={CHART_H-eh} width={BAR_W} height={eh} rx={4} fill="#F87171"           opacity={last?1:0.5}/>
                      <text x={x+BAR_W+GAP/2} y={CHART_H+18} textAnchor="middle" className={styles.barLabel}>{d.month}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Gastos por categoría</span>
              <span className={styles.cardSubtitle}>{fmt(categories.reduce((s,c)=>s+c.amount,0))}</span>
            </div>
            <div className={styles.categories}>
              {categories.map((cat,i)=>(
                <div key={cat.name} className={[styles.catRow,styles.clickable].join(' ')} onClick={()=>open({kind:'category',i})}>
                  <div className={styles.catMeta}>
                    <span className={styles.catName}>{cat.name}</span>
                    <span className={styles.catAmount}>{fmt(cat.amount)}</span>
                  </div>
                  <div className={styles.catBarTrack}>
                    <div className={styles.catBarFill} style={{width:`${(cat.amount/Math.max(...categories.map(c=>c.amount)))*100}%`,background:cat.color}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Aging + Budget */}
        <div className={styles.twoCol}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Aging de facturas</span>
              <span className={styles.cardSubtitle}>{fmt(AGING.reduce((s,a)=>s+a.amount,0))} pendiente</span>
            </div>
            <div className={styles.agingGrid}>
              {AGING.map((a,i)=>(
                <div key={a.label} className={[styles.agingBucket,styles.clickable].join(' ')} style={{background:a.bg,borderColor:a.color+'44'}} onClick={()=>open({kind:'aging',i})}>
                  <div className={styles.agingCount} style={{color:a.color}}>{a.count} {a.count===1?'factura':'facturas'}</div>
                  <div className={styles.agingAmount}>{a.amount>0?fmt(a.amount):'—'}</div>
                  <div className={styles.agingLabel}>{a.label}</div>
                  {a.amount>0&&<div className={styles.agingBar}><div className={styles.agingBarFill} style={{width:`${(a.amount/28300)*100}%`,background:a.color}}/></div>}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Budget vs Real</span>
              <button className={styles.editBtn} onClick={()=>{ setEditBudget(liveBudget.map(b=>({...b}))); setShowEditBudget(true); }}>
                <i className="ri-settings-3-line"/> Editar
              </button>
            </div>
            <div className={styles.budgetList}>
              {liveBudget.map((b,i)=>{
                const pct=b.budget>0?(b.actual/b.budget)*100:0, over=pct>100;
                return (
                  <div key={b.category} className={[styles.budgetRow,styles.clickable].join(' ')} onClick={()=>open({kind:'budget',i})}>
                    <div className={styles.budgetMeta}>
                      <span className={styles.budgetCat}>{b.category}</span>
                      <div className={styles.budgetNums}>
                        <span className={styles.budgetActual} style={{color:over?'#F87171':'var(--color-text-primary)'}}>{fmt(b.actual)}</span>
                        <span className={styles.budgetOf}>/ {fmt(b.budget)}</span>
                        <span className={[styles.budgetPct,over?styles.budgetOver:styles.budgetOk].join(' ')}>{over?'+':''}{(pct-100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className={styles.budgetTrack}>
                      <div className={styles.budgetFill} style={{width:`${Math.min(pct,100)}%`,background:over?'#F87171':'var(--color-primary)'}}/>
                      {over&&<div className={styles.budgetOverflow}/>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cash projection + Client profitability */}
        <div className={styles.twoCol62}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Proyección de caja</span>
              <div className={styles.chartLegend}>
                <span className={styles.legendLine}/><span className={styles.legendLabel}>Real</span>
                <span className={styles.legendDashed}/><span className={styles.legendLabel}>Proyectado</span>
              </div>
            </div>
            <div className={styles.projWrap}>
              <svg viewBox={`0 0 ${PROJ_W} ${PROJ_H+24}`} preserveAspectRatio="none" className={styles.projSvg}>
                {[0.25,0.5,0.75].map(f=>(
                  <line key={f} x1={PAD} y1={PAD+f*(PROJ_H-PAD*2)} x2={PROJ_W-PAD} y2={PAD+f*(PROJ_H-PAD*2)} stroke="var(--color-border-light)" strokeWidth={0.8}/>
                ))}
                <defs>
                  <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="var(--color-primary)" stopOpacity="0.18"/>
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d={areaPath} fill="url(#projGrad)"/>
                <line x1={px(actualPts.length-1)} y1={PAD} x2={px(actualPts.length-1)} y2={PROJ_H} stroke="var(--color-border)" strokeWidth={1} strokeDasharray="4 3"/>
                <path d={pPath(actualPts)}         fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round"/>
                <path d={pPath(projPts,projBase)}  fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeDasharray="6 4" strokeLinejoin="round" opacity={0.6}/>
                {CASH_PROJECTION.map((d,i)=>(
                  <circle key={i} cx={px(i)} cy={py(d.value)} r={3.5} fill={d.projected?'var(--color-bg-card)':'var(--color-primary)'} stroke="var(--color-primary)" strokeWidth={2}/>
                ))}
                {CASH_PROJECTION.map((d,i)=>(
                  <text key={i} x={px(i)} y={PROJ_H+16} textAnchor="middle" className={styles.projLabel}>{d.month}</text>
                ))}
              </svg>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}><span className={styles.cardTitle}>Rentabilidad por cliente</span></div>
            <table className={styles.clientTable}>
              <thead><tr><th>Cliente</th><th className={styles.numCol}>Ingresos</th><th className={styles.numCol}>Margen</th></tr></thead>
              <tbody>
                {CLIENT_PROFIT.map((c,i)=>{
                  const margin=((c.revenue-c.costs)/c.revenue)*100;
                  const color=margin>=55?'#34D399':margin>=40?'#F5C842':'#F87171';
                  return (
                    <tr key={c.name} className={[styles.clientRow,styles.clickable].join(' ')} onClick={()=>open({kind:'client',i})}>
                      <td><div className={styles.clientName}>{c.name}</div><div className={styles.clientProjects}>{c.projects} proy.</div></td>
                      <td className={styles.numCol}><span className={styles.clientRevenue}>{fmt(c.revenue)}</span></td>
                      <td className={styles.numCol}>
                        <div className={styles.marginWrap}>
                          <span className={styles.marginPct} style={{color}}>{margin.toFixed(0)}%</span>
                          <div className={styles.marginTrack}><div className={styles.marginFill} style={{width:`${margin}%`,background:color}}/></div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transactions */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Movimientos recientes</span>
            <div className={styles.txFilterTabs}>
              {(['all','income','expense'] as const).map(f=>(
                <button key={f} className={[styles.txTab,txFilter===f?styles.txTabActive:''].join(' ')} onClick={()=>setTxFilter(f)}>
                  {f==='all'?'Todos':f==='income'?'Ingresos':'Gastos'}
                </button>
              ))}
            </div>
          </div>
          <table className={styles.txTable}>
            <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Estado</th><th className={styles.txAmountCol}>Monto</th></tr></thead>
            <tbody>
              {txs.map(tx=>(
                <tr key={tx.id} className={styles.txRow}>
                  <td className={styles.txDate}>{fmtDate(tx.date)}</td>
                  <td className={styles.txDesc}>{tx.description}</td>
                  <td><span className={styles.txCategory}>{tx.category}</span></td>
                  <td><span className={[styles.txStatus,tx.status==='paid'?styles.txPaid:styles.txPending].join(' ')}>{tx.status==='paid'?'Pagado':'Pendiente'}</span></td>
                  <td className={[styles.txAmount,tx.type==='income'?styles.txIncome:styles.txExpense].join(' ')}>{tx.type==='income'?'+':'-'}{fmt(tx.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      </div>

      {/* ── Registrar horas modal ── */}
      {showNewHour && ReactDOM.createPortal(
        <div className={styles.modalOverlay} onClick={()=>setShowNewHour(false)}>
          <div className={styles.modalBox} onClick={e=>e.stopPropagation()}>
            <div className={styles.detailHeader}>
              <div><h3 className={styles.detailTitle}>Registrar horas</h3><p className={styles.detailSub}>Cargá horas trabajadas por proyecto</p></div>
              <button className={styles.detailClose} onClick={()=>setShowNewHour(false)}><i className="ri-close-line"/></button>
            </div>
            <div className={styles.detailBody}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Empleado</label>
                  <select className={styles.formSelect} value={newHour.employee} onChange={e=>setNewHour(p=>({...p,employee:e.target.value}))}>
                    <option value="">Seleccioná...</option>
                    {EMPLOYEES.map(em=><option key={em} value={em}>{em}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Proyecto</label>
                  <select className={styles.formSelect} value={newHour.project} onChange={e=>setNewHour(p=>({...p,project:e.target.value}))}>
                    <option value="">Seleccioná...</option>
                    {PROJECTS_LIST.map(pr=><option key={pr} value={pr}>{pr}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Horas</label>
                  <input className={styles.formInput} type="number" min="0" step="0.5" placeholder="Ej: 4.5" value={newHour.hours} onChange={e=>setNewHour(p=>({...p,hours:e.target.value}))}/>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Fecha</label>
                  <input className={styles.formInput} type="date" value={newHour.date} onChange={e=>setNewHour(p=>({...p,date:e.target.value}))}/>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tarifa / hora</label>
                  <div className={styles.amountInput}>
                    <span className={styles.amountPrefix}>$</span>
                    <input className={styles.formInput} style={{paddingLeft:28}} type="number" min="0" placeholder="0" value={newHour.rate} onChange={e=>setNewHour(p=>({...p,rate:e.target.value}))}/>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tipo</label>
                  <div className={styles.typeToggle}>
                    <button className={[styles.typeBtn,newHour.billable?styles.typeBtnIncome:''].join(' ')} onClick={()=>setNewHour(p=>({...p,billable:true}))}>
                      <i className="ri-money-dollar-circle-line"/> Facturable
                    </button>
                    <button className={[styles.typeBtn,!newHour.billable?styles.statusBtnActive:''].join(' ')} onClick={()=>setNewHour(p=>({...p,billable:false}))}>
                      <i className="ri-building-line"/> Interno
                    </button>
                  </div>
                </div>
                <div className={styles.formGroup} style={{gridColumn:'1/-1'}}>
                  <label className={styles.formLabel}>Descripción</label>
                  <input className={styles.formInput} placeholder="¿En qué trabajaste?" value={newHour.description} onChange={e=>setNewHour(p=>({...p,description:e.target.value}))}/>
                </div>
              </div>

              {hourError && <p className={styles.formError}><i className="ri-error-warning-line"/> {hourError}</p>}

              <div className={styles.modalActions}>
                <button className={styles.btnCancel} onClick={()=>setShowNewHour(false)}>Cancelar</button>
                <button className={styles.btnSubmit} onClick={handleAddHour}>
                  <i className="ri-check-line"/> Registrar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Employee detail modal ── */}
      {selectedEmployee && ReactDOM.createPortal((() => {
        const empHours  = periodHours.filter(h => h.employee === selectedEmployee);
        const empTotal  = empHours.reduce((s,h) => s + h.hours, 0);
        const empBill   = empHours.filter(h => h.billable).reduce((s,h) => s + h.hours, 0);
        const empCost   = empHours.reduce((s,h) => s + h.hours * h.rate, 0);
        const empRate   = empHours.length ? empHours[0].rate : 0;

        // Group by project
        const byProject: Record<string,{hours:number;billable:number;cost:number;entries:HourEntry[]}> = {};
        empHours.forEach(h => {
          if (!byProject[h.project]) byProject[h.project] = {hours:0,billable:0,cost:0,entries:[]};
          byProject[h.project].hours    += h.hours;
          byProject[h.project].cost     += h.hours * h.rate;
          if (h.billable) byProject[h.project].billable += h.hours;
          byProject[h.project].entries.push(h);
        });
        const projects = Object.entries(byProject).sort((a,b) => b[1].hours - a[1].hours);
        const maxProjHours = Math.max(...projects.map(([,v]) => v.hours));
        const initials = selectedEmployee.split(' ').map(w=>w[0]).join('').slice(0,2);

        return (
          <div className={styles.modalOverlay} onClick={()=>setSelectedEmployee(null)}>
            <div className={[styles.modalBox,styles.empModalBox].join(' ')} onClick={e=>e.stopPropagation()}>
              {/* Header */}
              <div className={styles.detailHeader}>
                <div className={styles.empModalHead}>
                  <div className={styles.empModalAvatar}>{initials}</div>
                  <div>
                    <h3 className={styles.detailTitle}>{selectedEmployee}</h3>
                    <p className={styles.detailSub}>{empHours.length} registros · {empTotal.toFixed(1)}h totales</p>
                  </div>
                </div>
                <button className={styles.detailClose} onClick={()=>setSelectedEmployee(null)}><i className="ri-close-line"/></button>
              </div>

              <div className={styles.detailBody}>
                {/* KPI strip */}
                <div className={styles.empKpiRow}>
                  <div className={styles.empKpi}>
                    <span className={styles.empKpiVal}>{empTotal.toFixed(1)}h</span>
                    <span className={styles.empKpiLab}>Total horas</span>
                  </div>
                  <div className={styles.empKpi}>
                    <span className={styles.empKpiVal}>{empBill.toFixed(1)}h</span>
                    <span className={styles.empKpiLab}>Facturables</span>
                  </div>
                  <div className={styles.empKpi}>
                    <span className={styles.empKpiVal}>{fmt(empCost)}</span>
                    <span className={styles.empKpiLab}>Costo total</span>
                  </div>
                  <div className={styles.empKpi}>
                    <span className={styles.empKpiVal}>{projects.length}</span>
                    <span className={styles.empKpiLab}>Proyectos</span>
                  </div>
                </div>

                {/* By project */}
                <p className={styles.detailSection}>Distribución por proyecto</p>
                <div className={styles.empProjectList}>
                  {projects.map(([name,data]) => (
                    <div key={name} className={styles.empProjectRow}>
                      <div className={styles.empProjectMeta}>
                        <span className={styles.empProjectName}>{name}</span>
                        <div className={styles.empProjectNums}>
                          <span className={styles.empProjectHrs}>{data.hours.toFixed(1)}h</span>
                          <span className={[styles.hoursBadge,styles.hoursInternal].join(' ')}>{data.entries.length} registros</span>
                          <span className={styles.empProjectCost}>{fmt(data.cost)}</span>
                        </div>
                      </div>
                      <div className={styles.catBarTrack} style={{marginTop:6}}>
                        <div className={styles.catBarFill} style={{width:`${(data.hours/maxProjHours)*100}%`,background:'var(--color-primary)'}}/>
                      </div>
                      {/* Entries for this project */}
                      <div className={styles.empEntryList}>
                        {[...data.entries].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map(e=>(
                          <div key={e.id} className={styles.empEntry}>
                            <span className={styles.empEntryDate}>{fmtDate(e.date)}</span>
                            <span className={styles.empEntryDesc}>{e.description || '—'}</span>
                            <span className={styles.empEntryHrs}>{e.hours}h</span>
                            <span className={[styles.hoursBadge,e.billable?styles.hoursBillable:styles.hoursInternal].join(' ')}>{e.billable?'Fact.':'Int.'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.detailStat}>
                  <span>Tarifa / hora</span>
                  <span>{fmt(empRate)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* ── Nueva transacción modal ── */}
      {showNewTx && ReactDOM.createPortal(
        <div className={styles.modalOverlay} onClick={()=>setShowNewTx(false)}>
          <div className={styles.modalBox} onClick={e=>e.stopPropagation()}>
            <div className={styles.detailHeader}>
              <div><h3 className={styles.detailTitle}>Nuevo movimiento</h3><p className={styles.detailSub}>Registrá un ingreso o gasto</p></div>
              <button className={styles.detailClose} onClick={()=>setShowNewTx(false)}><i className="ri-close-line"/></button>
            </div>
            <div className={styles.detailBody}>
              {/* Type toggle */}
              <div className={styles.typeToggle}>
                <button className={[styles.typeBtn,newTx.type==='income'?styles.typeBtnIncome:''].join(' ')} onClick={()=>setNewTx(p=>({...p,type:'income',category:''}))}>
                  <i className="ri-arrow-up-circle-line"/> Ingreso
                </button>
                <button className={[styles.typeBtn,newTx.type==='expense'?styles.typeBtnExpense:''].join(' ')} onClick={()=>setNewTx(p=>({...p,type:'expense',category:''}))}>
                  <i className="ri-arrow-down-circle-line"/> Gasto
                </button>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Descripción</label>
                  <input className={styles.formInput} placeholder="Ej: Proyecto branding" value={newTx.description} onChange={e=>setNewTx(p=>({...p,description:e.target.value}))}/>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Categoría</label>
                  <select className={styles.formSelect} value={newTx.category} onChange={e=>setNewTx(p=>({...p,category:e.target.value}))}>
                    <option value="">Seleccioná...</option>
                    {(newTx.type==='income'?INCOME_CATS:EXPENSE_CATS).map(c=>(
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Monto</label>
                  <div className={styles.amountInput}>
                    <span className={styles.amountPrefix}>$</span>
                    <input className={styles.formInput} style={{paddingLeft:28}} type="number" min="0" placeholder="0" value={newTx.amount} onChange={e=>setNewTx(p=>({...p,amount:e.target.value}))}/>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Fecha</label>
                  <input className={styles.formInput} type="date" value={newTx.date} onChange={e=>setNewTx(p=>({...p,date:e.target.value}))}/>
                </div>
                <div className={styles.formGroup} style={{gridColumn:'1/-1'}}>
                  <label className={styles.formLabel}>Estado</label>
                  <div className={styles.statusToggle}>
                    <button className={[styles.statusBtn,newTx.status==='paid'?styles.statusBtnActive:''].join(' ')} onClick={()=>setNewTx(p=>({...p,status:'paid'}))}>
                      <i className="ri-checkbox-circle-line"/> Pagado
                    </button>
                    <button className={[styles.statusBtn,newTx.status==='pending'?styles.statusBtnPending:''].join(' ')} onClick={()=>setNewTx(p=>({...p,status:'pending'}))}>
                      <i className="ri-time-line"/> Pendiente
                    </button>
                  </div>
                </div>
              </div>

              {txError && <p className={styles.formError}><i className="ri-error-warning-line"/> {txError}</p>}

              <div className={styles.modalActions}>
                <button className={styles.btnCancel} onClick={()=>setShowNewTx(false)}>Cancelar</button>
                <button className={styles.btnSubmit} onClick={handleAddTx}>
                  <i className="ri-add-line"/> Registrar movimiento
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Editar presupuesto modal ── */}
      {showEditBudget && ReactDOM.createPortal(
        <div className={styles.modalOverlay} onClick={()=>setShowEditBudget(false)}>
          <div className={styles.modalBox} onClick={e=>e.stopPropagation()}>
            <div className={styles.detailHeader}>
              <div><h3 className={styles.detailTitle}>Editar presupuesto</h3><p className={styles.detailSub}>Configurá el budget mensual por categoría</p></div>
              <button className={styles.detailClose} onClick={()=>setShowEditBudget(false)}><i className="ri-close-line"/></button>
            </div>
            <div className={styles.detailBody}>
              <div className={styles.budgetEditList}>
                {editBudget.map((b,i)=>(
                  <div key={b.category} className={styles.budgetEditRow}>
                    <span className={styles.budgetEditCat}>{b.category}</span>
                    <div className={styles.amountInput}>
                      <span className={styles.amountPrefix}>$</span>
                      <input
                        className={styles.formInput} style={{paddingLeft:28}} type="number" min="0"
                        value={b.budget}
                        onChange={e=>setEditBudget(prev=>prev.map((x,j)=>j===i?{...x,budget:Number(e.target.value)}:x))}
                      />
                    </div>
                    <div className={styles.budgetEditActual}>Real: <strong>{fmt(b.actual)}</strong></div>
                  </div>
                ))}
              </div>
              <div className={styles.modalActions}>
                <button className={styles.btnCancel} onClick={()=>setShowEditBudget(false)}>Cancelar</button>
                <button className={styles.btnSubmit} onClick={handleSaveBudget}>
                  <i className="ri-save-line"/> Guardar cambios
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Detail modal ── */}
      {detail && ReactDOM.createPortal(
        <div className={styles.modalOverlay} onClick={close}>
          <div className={styles.modalBox} onClick={e=>e.stopPropagation()}>
            <DetailModal detail={detail} onClose={close} transactions={transactions} liveBudget={liveBudget} budgetTxs={budgetTxs} categories={categories}/>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── KPI Card ───────────────────────────────────────────────────── */
function KpiCard({icon,label,value,delta,positive,accent,muted,onClick}:{
  icon:string;label:string;value:string;delta:string;positive:boolean;accent?:boolean;muted?:boolean;onClick:()=>void;
}) {
  return (
    <div className={[styles.kpiCard,accent?styles.kpiCardAccent:'',styles.clickable].join(' ')} onClick={onClick}>
      <div className={styles.kpiTop}>
        <i className={`${icon} ${styles.kpiIcon}`}/>
        <span className={[styles.kpiDelta,muted?styles.kpiDeltaMuted:positive?styles.kpiDeltaPos:styles.kpiDeltaNeg].join(' ')}>{delta}</span>
      </div>
      <div className={styles.kpiValue}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
    </div>
  );
}

/* ── Detail Modal ───────────────────────────────────────────────── */
function DetailModal({detail,onClose,transactions,liveBudget,budgetTxs,categories}:{
  detail:Detail; onClose:()=>void;
  transactions:Transaction[];
  liveBudget:BudgetItem[];
  budgetTxs:(i:number)=>Transaction[];
  categories:{name:string;amount:number;color:string}[];
}) {
  const fmt=(n:number)=>'$'+n.toLocaleString('es-AR',{minimumFractionDigits:0});
  const fmtDate=(iso:string)=>new Date(iso+'T00:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'});

  const Header=({title,sub}:{title:string;sub?:string})=>(
    <div className={styles.detailHeader}>
      <div><h3 className={styles.detailTitle}>{title}</h3>{sub&&<p className={styles.detailSub}>{sub}</p>}</div>
      <button className={styles.detailClose} onClick={onClose}><i className="ri-close-line"/></button>
    </div>
  );

  const ingresos = transactions.filter(t=>t.type==='income'&&t.status==='paid').reduce((s,t)=>s+t.amount,0);
  const gastos   = transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  if (detail.kind==='kpi'&&detail.id==='ingresos') return (<>
    <Header title="Ingresos del mes" sub={`${fmt(ingresos)} cobrados`}/>
    <div className={styles.detailBody}>
      <p className={styles.detailSection}>Cobros registrados</p>
      {transactions.filter(t=>t.type==='income'&&t.status==='paid').map(t=>(
        <div key={t.id} className={styles.detailRow}>
          <div><div className={styles.detailRowLabel}>{t.description}</div><div className={styles.detailMeta}>{fmtDate(t.date)}</div></div>
          <span className={styles.txIncome}>+{fmt(t.amount)}</span>
        </div>
      ))}
      <p className={styles.detailSection} style={{marginTop:16}}>Pendiente de cobro</p>
      {transactions.filter(t=>t.type==='income'&&t.status==='pending').map(t=>(
        <div key={t.id} className={styles.detailRow}>
          <div><div className={styles.detailRowLabel}>{t.description}</div><div className={styles.detailMeta}>{fmtDate(t.date)}</div></div>
          <div className={styles.detailRowRight}><span className={styles.txIncome}>{fmt(t.amount)}</span><span className={[styles.txStatus,styles.txPending].join(' ')}>Pendiente</span></div>
        </div>
      ))}
      <div className={styles.detailStat}><span>Total cobrado</span><span className={styles.txIncome}>+{fmt(ingresos)}</span></div>
    </div>
  </>);

  if (detail.kind==='kpi'&&detail.id==='gastos') return (<>
    <Header title="Gastos del mes" sub={`${fmt(gastos)} total`}/>
    <div className={styles.detailBody}>
      <p className={styles.detailSection}>Por categoría</p>
      {categories.map(c=>(
        <div key={c.name} className={styles.detailRow}>
          <div className={styles.detailRowLeft}><span className={styles.catDot} style={{background:c.color}}/><span className={styles.detailRowLabel}>{c.name}</span></div>
          <span className={styles.txExpense}>-{fmt(c.amount)}</span>
        </div>
      ))}
      <div className={styles.detailStat}><span>Total gastos</span><span className={styles.txExpense}>-{fmt(gastos)}</span></div>
    </div>
  </>);

  if (detail.kind==='kpi'&&detail.id==='balance') {
    const bal=ingresos-gastos;
    return (<>
      <Header title="Balance neto" sub="Ingresos menos gastos"/>
      <div className={styles.detailBody}>
        <div className={styles.balanceCalc}>
          <div className={styles.balanceRow}><span>Ingresos</span><span className={styles.txIncome}>+{fmt(ingresos)}</span></div>
          <div className={styles.balanceRow}><span>Gastos</span><span className={styles.txExpense}>-{fmt(gastos)}</span></div>
          <div className={styles.balanceDivider}/>
          <div className={[styles.balanceRow,styles.balanceBig].join(' ')}><span>Balance</span><span className={styles.txIncome}>{fmt(bal)}</span></div>
        </div>
        <div className={styles.detailNote}>Margen neto: <strong>{ingresos>0?`${((bal/ingresos)*100).toFixed(0)}%`:'—'}</strong></div>
      </div>
    </>);
  }

  if (detail.kind==='kpi'&&detail.id==='cobrar') return (<>
    <Header title="Facturas por cobrar" sub={`${fmt(transactions.filter(t=>t.type==='income'&&t.status==='pending').reduce((s,t)=>s+t.amount,0))} pendiente`}/>
    <div className={styles.detailBody}>
      {transactions.filter(t=>t.type==='income'&&t.status==='pending').map(t=>(
        <div key={t.id} className={styles.detailRow}>
          <div><div className={styles.detailRowLabel}>{t.description}</div><div className={styles.detailMeta}>{fmtDate(t.date)}</div></div>
          <div className={styles.detailRowRight}><span className={styles.txIncome}>{fmt(t.amount)}</span><span className={[styles.txStatus,styles.txPending].join(' ')}>Pendiente</span></div>
        </div>
      ))}
      {transactions.filter(t=>t.type==='income'&&t.status==='pending').length===0&&(
        <div className={styles.emptyState}><i className="ri-checkbox-circle-line" style={{color:'#34D399',fontSize:'2rem'}}/><p>No hay facturas pendientes</p></div>
      )}
    </div>
  </>);

  if (detail.kind==='kpi'&&detail.id==='mrr') return (<>
    <Header title="Ingresos recurrentes" sub={`${fmt(MRR)}/mes de retainers`}/>
    <div className={styles.detailBody}>
      <p className={styles.detailSection}>Clientes con retainer</p>
      {MRR_CLIENTS.map((c,i)=>(
        <div key={i} className={styles.detailRow}>
          <div><div className={styles.detailRowLabel}>{c.name}</div><div className={styles.detailMeta}>Desde {c.since}</div></div>
          <div className={styles.detailRowRight}><span className={styles.txIncome}>{fmt(c.amount)}/mes</span><span className={[styles.txStatus,styles.txPaid].join(' ')}>Activo</span></div>
        </div>
      ))}
      <div className={styles.detailStat}><span>MRR total</span><span className={styles.txIncome}>{fmt(MRR)}/mes</span></div>
      <div className={styles.detailStat}><span>ARR estimado</span><span className={styles.txIncome}>{fmt(MRR*12)}/año</span></div>
    </div>
  </>);

  if (detail.kind==='aging') {
    const bucket=AGING[detail.i], invoices=AGING_INVOICES[detail.i];
    return (<>
      <Header title={`Aging — ${bucket.label}`} sub={bucket.amount>0?`${fmt(bucket.amount)} en ${bucket.count} facturas`:'Sin facturas'}/>
      <div className={styles.detailBody}>
        {invoices.length===0?(
          <div className={styles.emptyState}><i className="ri-checkbox-circle-line" style={{color:'#34D399',fontSize:'2rem'}}/><p>Sin facturas en este rango</p></div>
        ):invoices.map((inv,i)=>(
          <div key={i} className={styles.detailRow}>
            <div><div className={styles.detailRowLabel}>{inv.client}</div><div className={styles.detailMeta}>Emitida {fmtDate(inv.issued)} · Vence {fmtDate(inv.due)}</div></div>
            <div className={styles.detailRowRight}>
              <span className={styles.txIncome}>{fmt(inv.amount)}</span>
              <span className={[styles.txStatus,detail.i===0?styles.txPaid:styles.txPending].join(' ')}>{detail.i===0?`${inv.days}d`:`${inv.days}d vencida`}</span>
            </div>
          </div>
        ))}
      </div>
    </>);
  }

  if (detail.kind==='budget') {
    const b=liveBudget[detail.i], txList=budgetTxs(detail.i);
    const pct=b.budget>0?(b.actual/b.budget)*100:0, over=pct>100;
    return (<>
      <Header title={`Budget — ${b.category}`} sub={`${fmt(b.actual)} de ${fmt(b.budget)} presupuestado`}/>
      <div className={styles.detailBody}>
        <div className={styles.budgetDetailStat}>
          <div><span className={styles.detailMeta}>Ejecutado</span><span style={{color:over?'#F87171':'var(--color-text-primary)',fontWeight:700,fontSize:'1.2rem'}}>{pct.toFixed(0)}%</span></div>
          <div><span className={styles.detailMeta}>Disponible</span><span style={{fontWeight:700,fontSize:'1rem'}}>{over?'Excedido':fmt(b.budget-b.actual)}</span></div>
        </div>
        <div className={styles.budgetTrack} style={{marginBottom:16}}>
          <div className={styles.budgetFill} style={{width:`${Math.min(pct,100)}%`,background:over?'#F87171':'var(--color-primary)'}}/>
        </div>
        <p className={styles.detailSection}>Transacciones</p>
        {txList.length===0?<div className={styles.detailMeta}>Sin transacciones registradas.</div>:txList.map(t=>(
          <div key={t.id} className={styles.detailRow}>
            <div><div className={styles.detailRowLabel}>{t.description}</div><div className={styles.detailMeta}>{fmtDate(t.date)}</div></div>
            <div className={styles.detailRowRight}><span className={styles.txExpense}>-{fmt(t.amount)}</span><span className={[styles.txStatus,t.status==='paid'?styles.txPaid:styles.txPending].join(' ')}>{t.status==='paid'?'Pagado':'Pendiente'}</span></div>
          </div>
        ))}
      </div>
    </>);
  }

  if (detail.kind==='client') {
    const c=CLIENT_PROFIT[detail.i], projects=CLIENT_PROJECTS[detail.i];
    const margin=((c.revenue-c.costs)/c.revenue)*100;
    const color=margin>=55?'#34D399':margin>=40?'#F5C842':'#F87171';
    return (<>
      <Header title={c.name} sub={`${c.projects} proyectos · ${margin.toFixed(0)}% margen`}/>
      <div className={styles.detailBody}>
        <div className={styles.clientDetailStats}>
          <div><span className={styles.detailMeta}>Ingresos</span><span className={styles.txIncome} style={{fontWeight:700,fontSize:'1rem'}}>{fmt(c.revenue)}</span></div>
          <div><span className={styles.detailMeta}>Costos</span><span className={styles.txExpense} style={{fontWeight:700,fontSize:'1rem'}}>{fmt(c.costs)}</span></div>
          <div><span className={styles.detailMeta}>Margen</span><span style={{color,fontWeight:700,fontSize:'1rem'}}>{margin.toFixed(0)}%</span></div>
        </div>
        <p className={styles.detailSection}>Proyectos</p>
        {projects.map((p,i)=>(
          <div key={i} className={styles.detailRow}>
            <div><div className={styles.detailRowLabel}>{p.name}</div><div className={styles.detailMeta}>{fmtDate(p.date)}</div></div>
            <div className={styles.detailRowRight}>{p.amount>0&&<span className={styles.txIncome}>{fmt(p.amount)}</span>}<span className={[styles.txStatus,p.status==='paid'?styles.txPaid:styles.txPending].join(' ')}>{p.status==='paid'?'Pagado':'Pendiente'}</span></div>
          </div>
        ))}
      </div>
    </>);
  }

  if (detail.kind==='month') {
    const m=MONTHLY_DATA[detail.i], bal=m.income-m.expense;
    return (<>
      <Header title={`${m.month} — Detalle`} sub={`Balance: ${fmt(bal)}`}/>
      <div className={styles.detailBody}>
        <div className={styles.clientDetailStats}>
          <div><span className={styles.detailMeta}>Ingresos</span><span className={styles.txIncome} style={{fontWeight:700,fontSize:'1rem'}}>{fmt(m.income)}</span></div>
          <div><span className={styles.detailMeta}>Gastos</span><span className={styles.txExpense} style={{fontWeight:700,fontSize:'1rem'}}>{fmt(m.expense)}</span></div>
          <div><span className={styles.detailMeta}>Margen</span><span style={{fontWeight:700,fontSize:'1rem'}}>{((bal/m.income)*100).toFixed(0)}%</span></div>
        </div>
        <div className={styles.detailNote}>Los datos históricos son de referencia. Cargá movimientos reales para ver el detalle completo.</div>
      </div>
    </>);
  }

  if (detail.kind==='category') {
    const cat=categories[detail.i];
    const txList=transactions.filter(t=>t.type==='expense'&&t.category===cat?.name);
    return (<>
      <Header title={cat?.name||'Categoría'} sub={`${fmt(cat?.amount||0)} en total`}/>
      <div className={styles.detailBody}>
        <div className={styles.catDetailBar}>
          <div style={{height:8,borderRadius:99,background:'var(--color-bg-input)',overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:99,width:`${(cat.amount/categories.reduce((s,c)=>s+c.amount,0))*100}%`,background:cat.color}}/>
          </div>
          <div className={styles.detailMeta} style={{marginTop:4}}>{((cat.amount/categories.reduce((s,c)=>s+c.amount,0))*100).toFixed(0)}% del gasto total</div>
        </div>
        <p className={styles.detailSection} style={{marginTop:16}}>Transacciones</p>
        {txList.map(t=>(
          <div key={t.id} className={styles.detailRow}>
            <div><div className={styles.detailRowLabel}>{t.description}</div><div className={styles.detailMeta}>{fmtDate(t.date)}</div></div>
            <div className={styles.detailRowRight}><span className={styles.txExpense}>-{fmt(t.amount)}</span><span className={[styles.txStatus,t.status==='paid'?styles.txPaid:styles.txPending].join(' ')}>{t.status==='paid'?'Pagado':'Pendiente'}</span></div>
          </div>
        ))}
      </div>
    </>);
  }

  return null;
}
