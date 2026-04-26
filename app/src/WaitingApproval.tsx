import React, { useState } from 'react';
import styles from './WaitingApproval.module.css';

interface WaitingApprovalProps {
  profile: { name: string; email: string; picture: string; id: string; agencyName?: string };
  onApproved: () => void;
  onLogout: () => void;
}

function WaitingApproval({ profile, onApproved, onLogout }: WaitingApprovalProps) {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleCheck = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const res = await (window as any).electron.invoke('check-my-status', profile.id);
      if (res?.status === 'approved') {
        onApproved();
      } else {
        setMessage('Todavía estás en revisión. Esperá a que el administrador te asigne un rol.');
      }
    } catch {
      setMessage('No se pudo verificar el estado. Intentá de nuevo.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.clockIcon}>
          <i className="ri-time-line" />
        </div>

        <h1 className={styles.title}>Solicitud enviada</h1>
        <p className={styles.subtitle}>
          Tu solicitud para unirte a <strong>{profile.agencyName || 'la agencia'}</strong> está pendiente de aprobación.
          Un administrador te asignará un rol pronto.
        </p>

        <div className={styles.profileCard}>
          {profile.picture ? (
            <img src={profile.picture} alt={profile.name} className={styles.avatar} />
          ) : (
            <div className={styles.initials}>
              {profile.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
            </div>
          )}
          <div className={styles.profileInfo}>
            <span className={styles.profileName}>{profile.name}</span>
            <span className={styles.profileEmail}>{profile.email}</span>
          </div>
          <span className={styles.statusBadge}>
            <i className="ri-time-line" /> Pendiente
          </span>
        </div>

        {message && <p className={styles.message}>{message}</p>}

        <div className={styles.actions}>
          <button className={styles.checkBtn} onClick={handleCheck} disabled={checking}>
            {checking ? (
              <><i className="ri-loader-4-line" /> Verificando...</>
            ) : (
              <><i className="ri-refresh-line" /> Verificar estado</>
            )}
          </button>
          <button className={styles.logoutBtn} onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>

        <p className={styles.hint}>
          <i className="ri-information-line" />
          Si ya te aprobaron, hacé clic en "Verificar estado" para entrar.
        </p>
      </div>
    </div>
  );
}

export default WaitingApproval;
