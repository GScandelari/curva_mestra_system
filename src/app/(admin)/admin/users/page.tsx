"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, UserCog, Shield, User, Building2, Edit, KeyRound, CheckCircle2, Mail } from "lucide-react";
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { formatTimestamp } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserWithTenant {
  uid: string;
  email: string;
  displayName: string;
  role: "clinic_admin" | "clinic_user" | "system_admin";
  active: boolean;
  tenantId: string;
  tenantName: string;
  created_at: any;
}

export default function UsersManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserWithTenant[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Edit dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithTenant | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRole, setEditRole] = useState<"clinic_admin" | "clinic_user">("clinic_user");
  const [editActive, setEditActive] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Password reset states
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetEmailAddress, setResetEmailAddress] = useState<string | null>(null);

  useEffect(() => {
    loadAllUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, users]);

  const loadAllUsers = async () => {
    try {
      setLoading(true);
      const allUsers: UserWithTenant[] = [];

      // Buscar todos os usuários da coleção raiz
      const usersRef = collection(db, "users");
      const usersQuery = query(usersRef, orderBy("created_at", "desc"));
      const usersSnapshot = await getDocs(usersQuery);

      // Para cada usuário, buscar o nome do tenant
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const tenantId = userData.tenant_id;
        let tenantName = "Sem clínica";

        if (tenantId) {
          try {
            const tenantDoc = await getDoc(doc(db, "tenants", tenantId));
            if (tenantDoc.exists()) {
              tenantName = tenantDoc.data().name || "Sem nome";
            }
          } catch (err) {
            console.error(`Erro ao buscar tenant ${tenantId}:`, err);
          }
        }

        allUsers.push({
          uid: userDoc.id,
          email: userData.email || "",
          displayName: userData.displayName || userData.full_name || "",
          role: userData.role || "clinic_user",
          active: userData.active ?? true,
          tenantId: tenantId || "",
          tenantName,
          created_at: userData.created_at,
        });
      }

      setUsers(allUsers);
      setFilteredUsers(allUsers);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = users.filter(
      (user) =>
        user.displayName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.tenantName.toLowerCase().includes(term)
    );
    setFilteredUsers(filtered);
  };

  const getRoleBadge = (role: string) => {
    if (role === "system_admin") {
      return (
        <Badge variant="destructive" className="text-xs">
          System Admin
        </Badge>
      );
    }
    if (role === "clinic_admin") {
      return (
        <Badge variant="default" className="text-xs">
          Admin
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        Usuário
      </Badge>
    );
  };

  const getRoleIcon = (role: string) => {
    if (role === "clinic_admin" || role === "system_admin") {
      return <Shield className="h-4 w-4 text-primary" />;
    }
    return <User className="h-4 w-4 text-muted-foreground" />;
  };

  const handleEditUser = (user: UserWithTenant) => {
    setEditingUser(user);
    setEditDisplayName(user.displayName);
    setEditRole(user.role === "system_admin" ? "clinic_admin" : user.role);
    setEditActive(user.active);
    setResetEmailSent(false);
    setResetEmailAddress(null);
    setEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    try {
      setUpdating(true);

      // Atualizar no Firestore
      const userRef = doc(db, "users", editingUser.uid);
      await updateDoc(userRef, {
        displayName: editDisplayName,
        role: editRole,
        active: editActive,
        updated_at: new Date(),
      });

      alert("Usuário atualizado com sucesso!");
      setEditDialogOpen(false);
      loadAllUsers(); // Recarregar lista
    } catch (error: any) {
      console.error("Erro ao atualizar usuário:", error);
      alert(`Erro ao atualizar usuário: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editingUser) return;

    if (!confirm(`Tem certeza que deseja redefinir a senha de ${editingUser.email}?\n\nUm email será enviado com um link seguro para o usuário definir uma nova senha.`)) {
      return;
    }

    try {
      setResettingPassword(true);
      setResetEmailSent(false);
      setResetEmailAddress(null);

      // Obter token do usuário atual
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert("Você precisa estar autenticado para realizar esta ação");
        return;
      }

      const token = await currentUser.getIdToken();

      const response = await fetch(`/api/users/${editingUser.uid}/reset-password`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao solicitar reset de senha");
      }

      setResetEmailSent(true);
      setResetEmailAddress(data.email || editingUser.email);
    } catch (error: any) {
      console.error("Erro ao solicitar reset de senha:", error);
      alert(`Erro ao solicitar reset de senha: ${error.message}`);
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="container py-8">
          <div className="space-y-6">
            {/* Page Header */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <UserCog className="h-8 w-8 text-primary" />
                Usuários do Sistema
              </h1>
              <p className="text-muted-foreground">
                Gerencie todos os usuários de todas as clínicas
              </p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total de Usuários
                  </CardTitle>
                  <UserCog className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{users.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Todos os usuários
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Usuários Ativos
                  </CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {users.filter((u) => u.active).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Com acesso</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Administradores
                  </CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {
                      users.filter(
                        (u) =>
                          u.role === "clinic_admin" || u.role === "system_admin"
                      ).length
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">Clinic + System</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Clínicas</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Set(users.map((u) => u.tenantId)).size}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Com usuários
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Users Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Lista de Usuários</CardTitle>
                    <CardDescription>
                      Todos os usuários cadastrados no sistema
                    </CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, email ou clínica..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando usuários...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm
                      ? "Nenhum usuário encontrado"
                      : "Nenhum usuário cadastrado"}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Clínica</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Cadastro</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={`${user.tenantId}-${user.uid}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getRoleIcon(user.role)}
                                <span className="font-medium">
                                  {user.displayName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {user.email}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{user.tenantName}</span>
                              </div>
                            </TableCell>
                            <TableCell>{getRoleBadge(user.role)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={user.active ? "default" : "destructive"}
                              >
                                {user.active ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatTimestamp(user.created_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {user.role !== "system_admin" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditUser(user)}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Editar
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    router.push(`/admin/tenants/${user.tenantId}`)
                                  }
                                >
                                  Ver Clínica
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edit User Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Usuário</DialogTitle>
                  <DialogDescription>
                    Edite as informações do usuário {editingUser?.email}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Nome de Exibição</Label>
                    <Input
                      id="displayName"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      placeholder="Nome do usuário"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Função</Label>
                    <Select value={editRole} onValueChange={(value: "clinic_admin" | "clinic_user") => setEditRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clinic_admin">Admin da Clínica</SelectItem>
                        <SelectItem value="clinic_user">Usuário da Clínica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="active">Status</Label>
                    <Select value={editActive ? "active" : "inactive"} onValueChange={(value) => setEditActive(value === "active")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>Email:</strong> {editingUser?.email}</p>
                    <p><strong>Clínica:</strong> {editingUser?.tenantName}</p>
                  </div>

                  {/* Seção de Redefinir Senha */}
                  <div className="pt-4 border-t space-y-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                      <Label className="font-medium">Redefinir Senha</Label>
                    </div>

                    {resetEmailSent ? (
                      <div className="space-y-2">
                        <div className="p-3 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">
                              Email enviado com sucesso!
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span>Enviado para: <strong>{resetEmailAddress}</strong></span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            O usuário receberá um link seguro para definir uma nova senha. O link expira em 30 minutos.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Envie um email com link seguro para o usuário definir uma nova senha. O link expira em 30 minutos.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleResetPassword}
                          disabled={resettingPassword || updating}
                          className="w-full"
                        >
                          <KeyRound className="h-4 w-4 mr-2" />
                          {resettingPassword ? "Enviando..." : "Enviar Link de Reset"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                    disabled={updating}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveUser} disabled={updating}>
                    {updating ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
    </div>
  );
}
