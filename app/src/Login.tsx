import React, { useState } from 'react';
import styles from './Login.module.css';

interface GoogleProfile {
  name: string;
  email: string;
  picture: string;
  id: string;
  status?: string;
  agencyName?: string;
}

interface LoginProps {
  onLogin: (email: string, password: string, profile?: GoogleProfile) => void;
  onPending: (profile: GoogleProfile) => void;
}

function Login({ onLogin, onPending }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [joinMode, setJoinMode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Recovery code modal (shown after signup)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  // Forgot password flow
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState<'choose' | 'google-verify' | 'code-entry' | 'newpass'>('choose');
  const [forgotMethod, setForgotMethod] = useState<'google' | 'code' | null>(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailInput, setForgotEmailInput] = useState('');
  const [forgotCodeInput, setForgotCodeInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleJoinWithProfile = async (profile: GoogleProfile) => {
    const res = await (window as any).electron.invoke('request-to-join', { inviteCode, userProfile: profile });
    if (res?.success) {
      onPending({ ...profile, status: 'pending', agencyName: res.agencyName });
    } else {
      setFormError(res?.error || 'Código de invitación inválido');
      setFormLoading(false);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);
    try {
      if (isSignUp) {
        const result = await (window as any).electron.invoke('create-local-account', { email, password, name: name || undefined });
        if (result?.success) {
          if (result.recoveryCode) setRecoveryCode(result.recoveryCode);
          if (joinMode && inviteCode.trim()) {
            await handleJoinWithProfile(result.profile);
          } else {
            onLogin(email, password, result.profile);
          }
        } else {
          setFormError(result?.error || 'No se pudo crear la cuenta');
        }
      } else {
        const result = await (window as any).electron.invoke('login-local-account', { email, password });
        if (result?.success) {
          if (joinMode && inviteCode.trim()) {
            await handleJoinWithProfile(result.profile);
          } else {
            onLogin(email, password, result.profile);
          }
        } else {
          setFormError(result?.error || 'Email o contraseña incorrectos');
        }
      }
    } catch (err: any) {
      setFormError(err?.message || 'Error inesperado');
    } finally {
      setFormLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const result = await (window as any).electron.invoke('google-sign-in');
      if (result?.success && result?.profile) {
        if (joinMode && inviteCode.trim()) {
          await handleJoinWithProfile(result.profile);
        } else {
          onLogin(result.profile.email, '', result.profile);
        }
      } else {
        setGoogleError(result?.error || 'No se pudo iniciar sesión con Google');
      }
    } catch (e: any) {
      setGoogleError(e?.message || 'Error inesperado');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotGoogleVerify = async () => {
    setForgotLoading(true);
    setForgotError(null);
    try {
      const result = await (window as any).electron.invoke('google-sign-in');
      if (result?.success && result?.profile) {
        setForgotEmail(result.profile.email);
        setForgotStep('newpass');
      } else {
        setForgotError(result?.error || 'No se pudo verificar con Google');
      }
    } catch (e: any) {
      setForgotError(e?.message || 'Error inesperado');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotCodeVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmailInput.trim() || !forgotCodeInput.trim()) return;
    setForgotEmail(forgotEmailInput.trim());
    setForgotStep('newpass');
    setForgotMethod('code');
  };

  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setForgotError('Las contraseñas no coinciden'); return; }
    if (newPassword.length < 6) { setForgotError('La contraseña debe tener al menos 6 caracteres'); return; }
    setForgotLoading(true);
    setForgotError(null);
    try {
      let result;
      if (forgotMethod === 'code') {
        result = await (window as any).electron.invoke('reset-password-with-code', {
          email: forgotEmail, recoveryCode: forgotCodeInput, newPassword
        });
      } else {
        result = await (window as any).electron.invoke('reset-password', { email: forgotEmail, newPassword });
      }
      if (result?.success) {
        setForgotSuccess(true);
      } else {
        setForgotError(result?.error || 'No se pudo restablecer la contraseña');
      }
    } catch (e: any) {
      setForgotError(e?.message || 'Error inesperado');
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForgot = () => {
    setForgotMode(false);
    setForgotStep('choose');
    setForgotMethod(null);
    setForgotEmail('');
    setForgotEmailInput('');
    setForgotCodeInput('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError(null);
    setForgotSuccess(false);
  };

  // ── Recovery code modal ───────────────────────────────────────
  if (recoveryCode) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.logoSection}>
            <h1 className={styles.logo}>My Agency</h1>
            <p className={styles.tagline}>Guardá tu código de recuperación</p>
          </div>
          <div style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.25)', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
            <p style={{ color: '#F5C842', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px 0' }}>
              Código de recuperación
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.15em', margin: 0 }}>
              {recoveryCode}
            </p>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem', lineHeight: 1.6, margin: '0 0 16px 0' }}>
            Este código te permite restablecer tu contraseña si la olvidás. <strong style={{ color: 'var(--color-text-primary)' }}>No lo vas a poder ver de nuevo.</strong> Guardalo en un lugar seguro.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              className={styles.googleBtn}
              style={recoveryCopied ? { borderColor: '#4ade80', color: '#4ade80' } : {}}
              onClick={() => { navigator.clipboard.writeText(recoveryCode); setRecoveryCopied(true); }}
            >
              {recoveryCopied ? '✓ Copiado' : 'Copiar código'}
            </button>
          </div>
          <button className={styles.submitBtn} onClick={() => setRecoveryCode(null)}>
            Ya lo guardé, continuar
          </button>
        </div>
      </div>
    );
  }

  // ── Forgot password screen ────────────────────────────────────
  if (forgotMode) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.logoSection}>
            <h1 className={styles.logo}>My Agency</h1>
            <p className={styles.tagline}>Restablecer contraseña</p>
          </div>

          {forgotSuccess ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>✓</div>
              <p style={{ color: '#4ade80', fontWeight: 600, marginBottom: 8 }}>Contraseña actualizada</p>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: 24 }}>
                Ya podés iniciar sesión con tu nueva contraseña.
              </p>
              <button className={styles.submitBtn} onClick={resetForgot}>Volver al inicio de sesión</button>
            </div>

          ) : forgotStep === 'choose' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '0 0 4px 0' }}>
                ¿Cómo querés verificar tu identidad?
              </p>
              <button className={styles.googleBtn} onClick={() => { setForgotMethod('google'); setForgotStep('google-verify'); setForgotError(null); }}>
                <svg className={styles.googleIcon} viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Verificar con Google
              </button>
              <button className={styles.submitBtn} style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                onClick={() => { setForgotMethod('code'); setForgotStep('code-entry'); setForgotError(null); }}>
                <i className="ri-key-2-line" style={{ marginRight: 8 }} />
                Usar código de recuperación
              </button>
              <button className={styles.toggleBtn} onClick={resetForgot}>← Volver</button>
            </div>

          ) : forgotStep === 'google-verify' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
                Verificá tu identidad con Google. Usaremos tu email para encontrar la cuenta local asociada.
              </p>
              {forgotError && <p style={{ color: '#f87171', fontSize: '0.82rem', margin: 0 }}>{forgotError}</p>}
              <button className={styles.googleBtn} onClick={handleForgotGoogleVerify} disabled={forgotLoading}>
                {forgotLoading ? <span style={{ opacity: 0.7 }}>Abriendo Google...</span> : (
                  <>
                    <svg className={styles.googleIcon} viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Verificar con Google
                  </>
                )}
              </button>
              <button className={styles.toggleBtn} onClick={() => setForgotStep('choose')}>← Volver</button>
            </div>

          ) : forgotStep === 'code-entry' ? (
            <form onSubmit={handleForgotCodeVerify} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>
                Ingresá tu email y el código de recuperación que recibiste al crear tu cuenta.
              </p>
              <div className={styles.inputGroup}>
                <label>Email</label>
                <input type="email" value={forgotEmailInput} onChange={e => setForgotEmailInput(e.target.value)} placeholder="tu@email.com" required />
              </div>
              <div className={styles.inputGroup}>
                <label>Código de recuperación</label>
                <input
                  type="text"
                  value={forgotCodeInput}
                  onChange={e => setForgotCodeInput(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  required
                  style={{ fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                />
              </div>
              {forgotError && <p style={{ color: '#f87171', fontSize: '0.82rem', margin: 0 }}>{forgotError}</p>}
              <button type="submit" className={styles.submitBtn}>Verificar código</button>
              <button type="button" className={styles.toggleBtn} onClick={() => setForgotStep('choose')}>← Volver</button>
            </form>

          ) : (
            <form onSubmit={handleForgotReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem', margin: 0 }}>
                Cuenta: <strong style={{ color: 'var(--color-text-primary)' }}>{forgotEmail}</strong>
              </p>
              <div className={styles.inputGroup}>
                <label>Nueva contraseña</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
              </div>
              <div className={styles.inputGroup}>
                <label>Confirmar contraseña</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repetí la contraseña" required />
              </div>
              {forgotError && <p style={{ color: '#f87171', fontSize: '0.82rem', margin: 0 }}>{forgotError}</p>}
              <button type="submit" className={styles.submitBtn} disabled={forgotLoading}>
                {forgotLoading ? 'Guardando...' : 'Establecer nueva contraseña'}
              </button>
              <button type="button" className={styles.toggleBtn} onClick={resetForgot}>← Volver</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.logoSection}>
          <h1 className={styles.logo}>My Agency</h1>
          <p className={styles.tagline}>
            {joinMode ? 'Unirte a una agencia existente' : 'Colabora en tus proyectos de diseño'}
          </p>
        </div>

        {joinMode && (
          <div style={{ marginBottom: 16 }}>
            <div className={styles.inputGroup}>
              <label>Código de invitación</label>
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                placeholder="Ej: A1B2C3D4E5F6"
                required={joinMode}
                style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
              />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {isSignUp && (
            <div className={styles.inputGroup}>
              <label htmlFor="name">Nombre completo</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
              />
            </div>
          )}

          {formError && (
            <p style={{ color: '#f87171', fontSize: '0.82rem', margin: 0 }}>{formError}</p>
          )}

          <button type="submit" className={styles.submitBtn} disabled={formLoading}>
            {formLoading ? 'Un momento...' : isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>

          {!isSignUp && (
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'right', padding: 0, fontFamily: 'var(--font-sans)', textDecoration: 'underline', alignSelf: 'flex-end' }}
              onClick={() => { setForgotMode(true); setForgotStep('choose'); setForgotError(null); }}
            >
              Olvidé mi contraseña
            </button>
          )}

          <div className={styles.divider}>
            <span>o</span>
          </div>

          <button
            type="button"
            className={styles.googleBtn}
            onClick={handleGoogleLogin}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <span style={{ opacity: 0.7 }}>Abriendo Google...</span>
            ) : (
              <>
                <svg className={styles.googleIcon} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continuar con Google
              </>
            )}
          </button>

          {googleError && (
            <p style={{ color: '#f87171', fontSize: '0.8rem', textAlign: 'center', marginTop: '0.5rem' }}>
              {googleError}
            </p>
          )}
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <button className={styles.toggleBtn} onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? '¿Ya tenés cuenta? Iniciá sesión' : '¿No tenés cuenta? Registrate'}
          </button>
          <button className={styles.toggleBtn} style={{ borderColor: 'transparent', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}
            onClick={() => { setJoinMode(!joinMode); setInviteCode(''); setFormError(null); }}>
            {joinMode ? '← Volver a crear mi agencia' : '¿Tenés un código de invitación? Unirte a una agencia'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;

