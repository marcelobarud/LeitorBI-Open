import { Plus, RotateCcw, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { createUser, deleteUser, listUsers, updateUser } from "../api";
import type { AuthUser, ManagedUser } from "../types";
export function UsersAdminView({ currentUser }: { currentUser: AuthUser }) {
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
      setError(err instanceof Error ? err.message : "Erro inesperado ao carregar usuários.");
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
      setSuccess("Usuário criado com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao criar usuário.");
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
      setSuccess("Usuário atualizado com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao atualizar usuário.");
    }
  }

  async function handleDeleteUser(managedUser: ManagedUser) {
    if (managedUser.email === currentUser.email) {
      setError("Você não pode remover seu próprio usuário.");
      return;
    }

    const confirmed = window.confirm(`Remover o usuário ${managedUser.email}? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;

    setDeletingUserId(managedUser.id);
    setError("");
    setSuccess("");
    try {
      await deleteUser(managedUser.id);
      setUsers((current) => current.filter((user) => user.id !== managedUser.id));
      setSuccess("Usuário removido com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao remover usuário.");
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <div className="users-page">
      <header className="page-header">
        <Users size={22} />
        <div>
          <h2>Usuários</h2>
          <p>Gerencie quem pode acessar a área autenticada do LeitorBI.</p>
        </div>
      </header>

      <section className="users-create-panel">
        <div>
          <h3>Novo usuário</h3>
          <p>Crie acessos individuais. A senha inicial deve ser compartilhada por um canal seguro.</p>
        </div>
        <form className="users-create-form" onSubmit={handleCreateUser}>
          <label>
            <span>Nome</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do usuário"
              required
            />
          </label>
          <label>
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="analista@empresa.com"
              required
            />
          </label>
          <label>
            <span>Senha inicial</span>
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
            <span>Administrador</span>
          </label>
          <button className="primary-action" type="submit" disabled={saving}>
            <UserPlus size={18} />
            {saving ? "Criando..." : "Criar usuário"}
          </button>
        </form>
      </section>

      {error ? <div className="error">{error}</div> : null}
      {success ? <div className="status">{success}</div> : null}

      <section className="users-list-panel">
        <div className="table-toolbar">
          <div>
            <strong>{users.length}</strong>
            <span> usuários</span>
          </div>
          <button className="clear-filters-button" type="button" onClick={loadUsers} disabled={loading}>
            <RotateCcw size={15} />
            Atualizar
          </button>
        </div>

        {loading ? <div className="status">Carregando usuários...</div> : null}
        {!loading && !users.length ? (
          <div className="empty-data">
            <strong>Nenhum usuário encontrado.</strong>
            <span>Crie o primeiro usuário para liberar acesso ao app.</span>
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
                      {managedUser.is_admin ? "Administrador" : "Usuário"} ·{" "}
                      {managedUser.disabled ? "Desativado" : "Ativo"}
                      {isSelf ? " · Você" : ""}
                    </span>
                  </div>
                  <div className="user-row-actions">
                    <button
                      className="ghost-action"
                      type="button"
                      disabled={isSelf}
                      onClick={() => handleUpdateUser(managedUser.id, { is_admin: !managedUser.is_admin })}
                    >
                      {managedUser.is_admin ? "Remover admin" : "Tornar admin"}
                    </button>
                    <button
                      className="ghost-action"
                      type="button"
                      disabled={isSelf}
                      onClick={() => handleUpdateUser(managedUser.id, { disabled: !managedUser.disabled })}
                    >
                      {managedUser.disabled ? "Reativar" : "Desativar"}
                    </button>
                    <button
                      className="danger-action"
                      type="button"
                      title={isSelf ? "Você não pode remover seu próprio usuário" : "Remover usuário"}
                      aria-label={`Remover ${managedUser.email}`}
                      disabled={isSelf || deletingUserId === managedUser.id}
                      onClick={() => handleDeleteUser(managedUser)}
                    >
                      <Trash2 size={16} />
                      {deletingUserId === managedUser.id ? "Removendo..." : "Remover"}
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
