import React, { useState } from 'react';
import styles from './SetupAgency.module.css';

interface SetupAgencyProps {
  userProfile: { name: string; email: string; picture: string; id: string };
  onComplete: (agency: { name: string; description: string; owner: string; ownerId: string; createdAt: string }) => void;
}

function SetupAgency({ userProfile, onComplete }: SetupAgencyProps) {
  const [agencyName, setAgencyName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyName.trim()) return;
    setLoading(true);
    setError(null);
    const agency = {
      name: agencyName.trim(),
      description: description.trim(),
      owner: userProfile.name,
      ownerId: userProfile.id,
      createdAt: new Date().toISOString(),
    };
    const result = await (window as any).electron.invoke('save-agency-profile', agency);
    setLoading(false);
    if (result?.success) {
      onComplete(agency);
    } else {
      setError(result?.error || 'No se pudo crear la agencia');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.icon}>
          <i className="ri-building-2-line" />
        </div>
        <h1 className={styles.title}>Configurá tu agencia</h1>
        <p className={styles.subtitle}>
          Esto es lo que verán tus colaboradores al unirse a tu espacio.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Nombre de la agencia *</label>
            <input
              className={styles.input}
              type="text"
              value={agencyName}
              onChange={e => setAgencyName(e.target.value)}
              placeholder="Ej: Studio Noir, Creativa Co."
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Descripción <span className={styles.optional}>(opcional)</span></label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="¿En qué se especializa tu agencia?"
              rows={3}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.btn} disabled={loading || !agencyName.trim()}>
            {loading ? 'Creando...' : 'Crear agencia'}
            {!loading && <i className="ri-arrow-right-line" />}
          </button>
        </form>

        <div className={styles.userInfo}>
          {userProfile.picture ? (
            <img src={userProfile.picture} alt={userProfile.name} className={styles.userAvatar} />
          ) : (
            <div className={styles.userInitials}>
              {userProfile.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
            </div>
          )}
          <span className={styles.userName}>{userProfile.name}</span>
          <span className={styles.userBadge}>Propietario</span>
        </div>
      </div>
    </div>
  );
}

export default SetupAgency;
