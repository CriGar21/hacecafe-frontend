import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

function Icon({ name, size = 20 }) {
  const paths = {
    coffee: <><path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M17 11h1.5a3.5 3.5 0 0 1 0 7H16"/><path d="M7 4c-1 1-.5 2 0 3M11 3c-1 1-.5 2 0 3M15 4c-1 1-.5 2 0 3"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="m3 3 18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 3.8M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7a10 10 0 0 0 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    chef: <><path d="M6 11a4 4 0 1 1 2-7 5 5 0 0 1 8 1 4 4 0 1 1 2 7v8H6v-9Z"/><path d="M6 15h12"/></>,
    chart: <><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 5-7"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.coffee}</svg>;
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const usuario = await login(email, password);
      if (usuario.rol === "DUENO") navigate("/admin", { replace: true });
      else if (usuario.rol === "COCINA") navigate("/cocina", { replace: true });
      else navigate("/empleado", { replace: true });
    } catch {
      setError("No pudimos validar tus datos. Revisá el email y la contraseña. Si todavía no tenés cuenta, pedile al dueño que te registre desde Administración > Usuarios.");
    } finally {
      setCargando(false);
    }
  };

  const accesos = [
    { label: "Administración", info: "Gestión del negocio", icon: "chart", path: "/admin" },
    { label: "Cocina", info: "Pedidos y preparación", icon: "chef", path: "/cocina" },
    { label: "Atención", info: "Caja y pedidos", icon: "coffee", path: "/empleado" },
  ];

  return (
    <main className="hc-login">
      <div className="hc-login-backdrop" aria-hidden="true" />
      <div className="hc-login-grain" aria-hidden="true" />
      <header className="hc-login-top">
        <a className="hc-brand" href="/login" aria-label="HaceCafé inicio">
          <span className="hc-brand-mark"><Icon name="coffee" size={26}/></span>
          <span className="hc-brand-word">Hace<span>Café</span><small>CAFÉ · COCINA · ENCUENTRO</small></span>
        </a>
        <button className="hc-menu-link" type="button" onClick={() => navigate("/menu")}>Ver menú <Icon name="arrow" size={16}/></button>
      </header>

      <section className="hc-login-layout">
        <div className="hc-login-story">
          <div className="hc-story-kicker"><span /> UNA EXPERIENCIA HECHA CON INTENCIÓN</div>
          <h1>El ritual del buen café.<br/><em>El arte de hacerlo bien.</em></h1>
          <p className="hc-story-copy">Cada detalle importa. Entrá a tu espacio de trabajo y hacé que cada servicio sea memorable.</p>
          <div className="hc-story-rule"><span>01</span><div/><span>CALIDAD EN CADA DETALLE</span></div>
          <div className="hc-story-foot"><span className="hc-story-icon"><Icon name="shield" size={18}/></span><span>Un espacio de trabajo<br/><strong>simple, cuidado y seguro.</strong></span></div>
        </div>

        <div className="hc-login-panel">
          <div className="hc-panel-heading">
            <span className="hc-panel-overline">BIENVENIDO DE NUEVO</span>
            <h2>Ingresá a tu<br/><em>espacio.</em></h2>
            <p>Usá tus credenciales para continuar.</p>
          </div>
          <form onSubmit={handleLogin} className="hc-login-form">
            <label className="hc-field"><span>Correo electrónico</span><div className="hc-input-shell"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@hacecafe.com" autoComplete="email" required/></div></label>
            <label className="hc-field"><span>Contraseña</span><div className="hc-input-shell"><Icon name="lock" size={19}/><input type={verPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Ingresá tu contraseña" autoComplete="current-password" required/><button className="hc-reveal-password" type="button" onClick={()=>setVerPassword(v=>!v)} aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}><Icon name={verPassword ? "eyeOff" : "eye"} size={19}/></button></div></label>
            {error && <div className="hc-login-error" role="alert">{error}</div>}
            <button className="hc-submit" type="submit" disabled={cargando}><span>{cargando ? "Ingresando..." : "Entrar al sistema"}</span><Icon name="arrow" size={19}/></button>
          </form>
          <div className="hc-login-secure"><Icon name="shield" size={15}/><span>Acceso privado para el equipo HaceCafé</span></div>
          <div className="hc-access">
            <div className="hc-access-title"><span>ACCESOS DEL EQUIPO</span><i/></div>
            <div className="hc-access-grid">{accesos.map(a=><button type="button" className="hc-access-card" key={a.path} onClick={()=>navigate(a.path)}><span className="hc-access-icon"><Icon name={a.icon} size={19}/></span><span className="hc-access-label">{a.label}<small>{a.info}</small></span><Icon name="arrow" size={15}/></button>)}</div>
          </div>
        </div>
      </section>
      <footer className="hc-login-footer"><span>HACECafé <i>®</i></span><span>HECHO CON CUIDADO, SERVIDO CON CALMA</span><span>BUEN CAFÉ. BUENOS MOMENTOS.</span></footer>

      <style>{`
        .hc-login{--hc-gold:#d8aa70;--hc-cream:#f5eee5;--hc-muted:#b5a493;position:relative;isolation:isolate;min-height:100vh;overflow:hidden;background:#100b08;color:var(--hc-cream);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:28px clamp(20px,5vw,76px) 20px;display:flex;flex-direction:column}
        .hc-login-backdrop{position:absolute;inset:0;z-index:-3;background-image:linear-gradient(90deg,rgba(13,8,5,.88) 0%,rgba(13,8,5,.72) 40%,rgba(13,8,5,.82) 100%),url("https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=2400&q=90");background-size:cover;background-position:center;transform:scale(1.035);animation:hc-login-drift 28s ease-in-out infinite alternate}
        .hc-login:after{content:"";position:absolute;inset:0;z-index:-2;pointer-events:none;background:radial-gradient(ellipse at 25% 45%,rgba(175,107,46,.16),transparent 44%),linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.38))}
        .hc-login-grain{position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.11;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.25'/%3E%3C/svg%3E")}
        .hc-login-top{display:flex;align-items:center;justify-content:space-between;max-width:1440px;width:100%;margin:0 auto;animation:hc-login-enter .8s both}
        .hc-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--hc-cream)}
        .hc-brand-mark{width:46px;height:46px;display:grid;place-items:center;border:1px solid rgba(216,170,112,.6);border-radius:15px;color:var(--hc-gold);background:linear-gradient(145deg,rgba(216,170,112,.17),rgba(255,255,255,.025));box-shadow:inset 0 0 18px rgba(216,170,112,.08)}
        .hc-brand-word{font-family:Georgia,serif;font-size:25px;letter-spacing:-.06em;font-weight:600}.hc-brand-word>span{color:var(--hc-gold)}.hc-brand-word small{display:block;margin-top:3px;font:700 8px/1.5 ui-sans-serif,system-ui;letter-spacing:.2em;color:#a8947e}
        .hc-menu-link{display:flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:10px 15px;background:rgba(16,10,6,.3);color:var(--hc-cream);font-size:12px;cursor:pointer;backdrop-filter:blur(12px);transition:border-color .2s,background .2s}.hc-menu-link:hover{border-color:var(--hc-gold);background:rgba(216,170,112,.1)}
        .hc-login-layout{flex:1;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(360px,.8fr);gap:clamp(50px,9vw,150px);align-items:center;width:100%;max-width:1240px;margin:34px auto 42px}
        .hc-login-story{max-width:650px;animation:hc-login-enter .9s .08s both}.hc-story-kicker{display:flex;align-items:center;gap:11px;color:#e0b984;font-size:10px;font-weight:800;letter-spacing:.22em}.hc-story-kicker>span{width:27px;height:1px;background:var(--hc-gold)}
        .hc-login-story h1{margin:28px 0 22px;font-family:Georgia,"Times New Roman",serif;font-size:clamp(44px,5.5vw,78px);line-height:1.04;font-weight:400;letter-spacing:-.055em;color:#fff8ef}.hc-login-story h1 em,.hc-panel-heading h2 em{font-weight:400;color:var(--hc-gold)}
        .hc-story-copy{max-width:420px;font-size:15px;line-height:1.9;color:#c8b9a8}
        .hc-story-rule{display:flex;align-items:center;gap:14px;margin-top:48px;color:#d3b48e;font-size:9px;font-weight:800;letter-spacing:.18em}.hc-story-rule>span:first-child{font-family:Georgia,serif;font-size:16px;color:var(--hc-gold)}.hc-story-rule>div{width:58px;height:1px;background:rgba(216,170,112,.5)}
        .hc-story-foot{display:flex;align-items:center;gap:13px;margin-top:55px;color:#b8a794;font-size:12px;line-height:1.6}.hc-story-foot strong{color:#f3e6d6;font-weight:600}.hc-story-icon{display:grid;place-items:center;width:39px;height:39px;border:1px solid rgba(216,170,112,.35);border-radius:50%;color:var(--hc-gold)}
        .hc-login-panel{position:relative;padding:clamp(26px,3.2vw,44px);border:1px solid rgba(231,200,165,.2);border-radius:5px;background:linear-gradient(145deg,rgba(39,27,19,.86),rgba(18,12,8,.88));box-shadow:0 32px 100px rgba(0,0,0,.42),inset 0 1px rgba(255,255,255,.06);backdrop-filter:blur(24px);animation:hc-panel-enter 1s .15s both}.hc-login-panel:before{content:"";position:absolute;top:-1px;left:32px;width:70px;height:2px;background:var(--hc-gold)}
        .hc-panel-overline{font-size:9px;font-weight:800;letter-spacing:.22em;color:#d6ac7a}.hc-panel-heading h2{margin:15px 0 8px;font-family:Georgia,serif;font-size:clamp(34px,3.2vw,45px);line-height:1.02;letter-spacing:-.045em;font-weight:400;color:#fff7ec}.hc-panel-heading p{margin:0;color:#b6a492;font-size:12px}
        .hc-login-form{display:grid;gap:18px;margin-top:29px}.hc-field{display:grid;gap:9px}.hc-field>span{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#d8c5b0}
        .hc-input-shell{display:flex;align-items:center;gap:11px;min-height:51px;padding:0 14px;border:1px solid rgba(222,190,154,.2);border-radius:3px;background:rgba(6,4,3,.28);color:#c8a77f;transition:border-color .2s,box-shadow .2s,background .2s}.hc-input-shell:focus-within{border-color:#d6a76b;background:rgba(6,4,3,.42);box-shadow:0 0 0 3px rgba(214,167,107,.1)}.hc-input-shell>svg{width:19px;height:19px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
        .hc-input-shell input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#fff1e0;font:13px ui-sans-serif,system-ui;padding:15px 0}.hc-input-shell input::placeholder{color:#806e5d}.hc-reveal-password{display:grid;place-items:center;border:0;background:transparent;color:#ad9880;cursor:pointer;padding:5px}.hc-reveal-password:hover{color:var(--hc-gold)}
        .hc-submit{display:flex;align-items:center;justify-content:space-between;margin-top:3px;padding:0 19px;min-height:53px;border:1px solid #e6bd86;border-radius:3px;background:linear-gradient(110deg,#e6c08e,#c38b4e);color:#211307;font-size:12px;font-weight:800;letter-spacing:.035em;cursor:pointer;box-shadow:0 10px 28px rgba(0,0,0,.2);transition:transform .2s,filter .2s,box-shadow .2s}.hc-submit:hover:not(:disabled){transform:translateY(-2px);filter:brightness(1.06);box-shadow:0 14px 35px rgba(0,0,0,.28)}.hc-submit:disabled{opacity:.65;cursor:wait}
        .hc-login-error{padding:11px 12px;border:1px solid rgba(225,112,102,.35);background:rgba(150,42,34,.14);color:#ffc0b6;font-size:12px;line-height:1.5}
        .hc-login-secure{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:18px;color:#a89682;font-size:10px}.hc-login-secure svg{color:#d2a66e}
        .hc-access{margin-top:28px;padding-top:22px;border-top:1px solid rgba(231,200,165,.13)}.hc-access-title{display:flex;align-items:center;gap:10px;color:#aa9580;font-size:8px;font-weight:800;letter-spacing:.18em}.hc-access-title i{height:1px;flex:1;background:rgba(231,200,165,.13)}
        .hc-access-grid{display:grid;gap:7px;margin-top:13px}.hc-access-card{display:flex;align-items:center;gap:11px;width:100%;padding:10px 11px;border:1px solid rgba(231,200,165,.1);border-radius:3px;background:rgba(255,255,255,.018);color:#e9d8c5;text-align:left;cursor:pointer;transition:background .2s,border-color .2s,transform .2s}.hc-access-card:hover{transform:translateX(3px);background:rgba(216,170,112,.07);border-color:rgba(216,170,112,.38)}.hc-access-icon{display:grid;place-items:center;width:34px;height:34px;border:1px solid rgba(216,170,112,.22);color:var(--hc-gold);flex-shrink:0}.hc-access-label{flex:1;font-size:11px;font-weight:700}.hc-access-label small{display:block;margin-top:3px;font-size:10px;font-weight:400;color:#9e8a76}.hc-access-card>svg{color:#b9956a}
        .hc-login-footer{display:flex;align-items:center;justify-content:space-between;gap:18px;max-width:1440px;width:100%;margin:0 auto;color:#8f7a65;font-size:8px;font-weight:700;letter-spacing:.15em}.hc-login-footer>span:first-child{font-family:Georgia,serif;font-size:12px;color:#d6b185;letter-spacing:.04em}.hc-login-footer i{font:normal 8px ui-sans-serif}
        @keyframes hc-login-enter{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}@keyframes hc-panel-enter{from{opacity:0;transform:translateY(24px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes hc-login-drift{from{transform:scale(1.035) translate3d(0,0,0)}to{transform:scale(1.09) translate3d(-.6%,.4%,0)}}
        @media(max-width:900px){.hc-login-layout{grid-template-columns:minmax(0,1fr) minmax(330px,.9fr);gap:32px}.hc-login-story h1{font-size:clamp(42px,6vw,62px)}.hc-login-footer>span:nth-child(2){display:none}}
        @media(max-width:680px){.hc-login{padding:18px 16px 16px}.hc-login-top{padding:0 2px}.hc-brand-mark{width:40px;height:40px}.hc-brand-word{font-size:22px}.hc-menu-link{padding:9px 11px}.hc-login-layout{display:flex;flex-direction:column;align-items:stretch;gap:28px;margin:48px auto 30px;max-width:460px}.hc-login-story h1{font-size:clamp(42px,11vw,61px);margin:20px 0 15px}.hc-story-copy{font-size:13px;line-height:1.7}.hc-story-rule{margin-top:25px}.hc-story-foot{display:none}.hc-login-panel{padding:25px 21px}.hc-panel-heading h2{font-size:38px}.hc-login-footer{justify-content:center;text-align:center}.hc-login-footer>span:last-child{display:none}.hc-login-backdrop{background-position:58% center}}
        @media(prefers-reduced-motion:reduce){.hc-login-backdrop,.hc-login-top,.hc-login-story,.hc-login-panel{animation:none!important}.hc-submit,.hc-access-card,.hc-menu-link{transition:none!important}}
      `}</style>
    </main>
  );
}
