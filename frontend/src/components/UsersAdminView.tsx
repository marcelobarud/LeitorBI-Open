import { Plus, RotateCcw, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { createUser, deleteUser, listUsers, updateUser } from "../api";
import type { AuthUser, ManagedUser } from "../types";
import { translateApiError, useLocale } from "../i18n/LocaleProvider";
export function UsersAdminView({ currentUser }: { currentUser: AuthUser }) {
  const { t } = useLocale();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      setUsers(await listUsers());
    } catch (err) {
      setError(err instanceof Error ? translateApiError(err.message, t) : t("admin.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const created = await createUser(name, email, password, isAdmin);
      setUsers((current) => [created, ...current]);
      setName("");
      setEmail("");
      setPassword("");
      setIsAdmin(false);
      setSuccess(t("admin.created"));
    } catch (err) {
      setError(err instanceof Error ? translateApiError(err.message, t) : t("admin.createError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateUser(userId: number, changes: Partial<Pick<ManagedUser, "is_admin" | "disabled">>) {
    setError("");
    setSuccess("");
    try {
      const updated = await updateUser(userId, changes);
      setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
      setSuccess(t("admin.updated"));
    } catch (err) {
      setError(err instanceof Error ? translateApiError(err.message, t) : t("admin.updateError"));
    }
  }

  async function handleDeleteUser(managedUser: ManagedUser) {
    if (managedUser.email === currentUser.email) {
      setError(t("admin.cannotRemoveSelf"));
      return;
    }

    const confirmed = window.confirm(t("admin.deleteConfirmation", { email: managedUser.email }));
    if (!confirmed) return;

    setDeletingUserId(managedUser.id);
    setError("");
    setSuccess("");
    try {
      await deleteUser(managedUser.id);
      setUsers((current) => current.filter((user) => user.id !== managedUser.id));
      setSuccess(t("admin.removed"));
    } catch (err) {
      setError(err instanceof Error ? translateApiError(err.message, t) : t("admin.deleteError"));
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <div className="users-page">
      <header className="page-header">
        <Users size={22} />
        <div>
          <h2>{t("admin.title")}</h2>
          <p>{t("admin.description")}</p>
        </div>
      </header>

      <section className="users-create-panel">
        <div>
          <h3>{t("admin.newUser")}</h3>
          <p>{t("admin.newUserDescription")}</p>
        </div>
        <form className="users-create-form" onSubmit={handleCreateUser}>
          <label>
            <span>{t("common.name")}</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("admin.namePlaceholder")}
              required
            />
          </label>
          <label>
            <span>{t("common.email")}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="analista@empresa.com"
              required
            />
          </label>
          <label>
            <span>{t("admin.initialPassword")}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={isAdmin} onChange={(event) => setIsAdmin(event.target.checked)} />
            <span>{t("admin.administrator")}</span>
          </label>
          <button className="primary-action" type="submit" disabled={saving}>
            <UserPlus size={18} />
            {saving ? t("admin.creating") : t("admin.createUser")}
          </button>
        </form>
      </section>

      {error ? <div className="error">{error}</div> : null}
      {success ? <div className="status">{success}</div> : null}

      <section className="users-list-panel">
        <div className="table-toolbar">
          <div>
            <strong>{users.length}</strong>
            <span>{t("admin.users", { count: users.length }).replace(String(users.length), "")}</span>
          </div>
          <button className="clear-filters-button" type="button" onClick={loadUsers} disabled={loading}>
            <RotateCcw size={15} />
            {t("common.refresh")}
          </button>
        </div>

        {loading ? <div className="status">{t("admin.loadingUsers")}</div> : null}
        {!loading && !users.length ? (
          <div className="empty-data">
            <strong>{t("admin.noUsers")}</strong>
            <span>{t("admin.noUsersDescription")}</span>
          </div>
        ) : null}
        {!loading && users.length ? (
          <div className="users-list">
            {users.map((managedUser) => {
              const isSelf = managedUser.email === currentUser.email;
              return (
                <article className={managedUser.disabled ? "user-row disabled" : "user-row"} key={managedUser.id}>
                  <div>
                    <strong>{managedUser.name || managedUser.email}</strong>
                    {managedUser.name ? <small>{managedUser.email}</small> : null}
                    <span>
                      {managedUser.is_admin ? t("admin.administrator") : t("admin.user")} ·{" "}
                      {managedUser.disabled ? t("admin.disabled") : t("admin.active")}
                      {isSelf ? ` · ${t("admin.you")}` : ""}
                    </span>
                  </div>
                  <div className="user-row-actions">
                    <button
                      className="ghost-action"
                      type="button"
                      disabled={isSelf}
                      onClick={() => handleUpdateUser(managedUser.id, { is_admin: !managedUser.is_admin })}
                    >
                      {managedUser.is_admin ? t("admin.removeAdmin") : t("admin.makeAdmin")}
                    </button>
                    <button
                      className="ghost-action"
                      type="button"
                      disabled={isSelf}
                      onClick={() => handleUpdateUser(managedUser.id, { disabled: !managedUser.disabled })}
                    >
                      {managedUser.disabled ? t("admin.reactivate") : t("admin.disable")}
                    </button>
                    <button
                      className="danger-action"
                      type="button"
                      title={isSelf ? t("admin.cannotRemoveSelf") : t("admin.removeUser")}
                      aria-label={`${t("admin.remove")} ${managedUser.email}`}
                      disabled={isSelf || deletingUserId === managedUser.id}
                      onClick={() => handleDeleteUser(managedUser)}
                    >
                      <Trash2 size={16} />
                      {deletingUserId === managedUser.id ? t("admin.removing") : t("admin.remove")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
