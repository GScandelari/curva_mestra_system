"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Search,
  UserCog,
  Shield,
  User,
  AlertTriangle,
  UserPlus,
} from "lucide-react";
import { collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { formatTimestamp } from "@/lib/utils";

interface ClinicUser {
  uid: string;
  email: string;
  displayName: string;
  role: "clinic_admin" | "clinic_user";
  active: boolean;
  created_at: any;
}

export default function ClinicUsersPage() {
  const router = useRouter();
  const { claims, user } = useAuth();
  const [users, setUsers] = useState<ClinicUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<ClinicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [maxUsers, setMaxUsers] = useState(5);

  // Estados do diálogo
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    displayName: "",
    password: "",
    role: "clinic_user" as "clinic_admin" | "clinic_user",
  });

  const tenantId = claims?.tenant_id;
  const isAdmin = claims?.role === "clinic_admin";

  useEffect(() => {
    if (tenantId) {
      loadUsers();
      loadTenantInfo();
    }
  }, [tenantId]);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, users]);

  const loadTenantInfo = async () => {
    if (!tenantId) return;

    try {
      const tenantRef = doc(db, "tenants", tenantId);
      const tenantDoc = await getDoc(tenantRef);

      if (tenantDoc.exists()) {
        const tenantData = tenantDoc.data();
        // Usar max_users do tenant (baseado em CPF=1 ou CNPJ=5)
        const limit = tenantData.max_users || 5; // Fallback para 5 se não existir
        setMaxUsers(limit);
      }
    } catch (err) {
      console.error("Erro ao carregar informações do tenant:", err);
    }
  };

  const loadUsers = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      setError("");

      const usersRef = collection(db, "tenants", tenantId, "users");
      const usersQuery = query(usersRef, orderBy("created_at", "desc"));
      const usersSnapshot = await getDocs(usersQuery);

      const loadedUsers: ClinicUser[] = [];
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        loadedUsers.push({
          uid: doc.id,
          email: data.email || "",
          displayName: data.displayName || "",
          role: data.role || "clinic_user",
          active: data.active ?? true,
          created_at: data.created_at,
        });
      });

      setUsers(loadedUsers);
      setFilteredUsers(loadedUsers);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
      setError("Erro ao carregar usuários da clínica");
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
        user.email.toLowerCase().includes(term)
    );
    setFilteredUsers(filtered);
  };

  const handleCreateUser = async () => {
    try {
      setCreating(true);
      setError("");

      // Validações
      if (!newUser.email || !newUser.displayName || !newUser.password) {
        setError("Todos os campos são obrigatórios");
        return;
      }

      if (newUser.password.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres");
        return;
      }

      // Obter token do usuário atual
      const idToken = await user?.getIdToken();
      if (!idToken) {
        setError("Erro de autenticação. Faça login novamente.");
        return;
      }

      // Chamar API para criar usuário
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar usuário");
      }

      // Sucesso - recarregar lista e fechar diálogo
      await loadUsers();
      setDialogOpen(false);
      setNewUser({
        email: "",
        displayName: "",
        password: "",
        role: "clinic_user",
      });
    } catch (err: any) {
      console.error("Erro ao criar usuário:", err);
      setError(err.message || "Erro ao criar usuário. Tente novamente.");
    } finally {
      setCreating(false);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === "clinic_admin") {
      return (
        <Badge variant="default" className="text-xs">
          Administrador
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
    if (role === "clinic_admin") {
      return <Shield className="h-4 w-4 text-primary" />;
    }
    return <User className="h-4 w-4 text-muted-foreground" />;
  };

  const canAddMoreUsers = users.length < maxUsers;

  return (
    <div className="container py-8">
      <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">
                  Usuários da Clínica
                </h2>
                <p className="text-muted-foreground">
                  Gerencie os usuários da sua clínica ({users.length}/{maxUsers})
                </p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!canAddMoreUsers}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Adicionar Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                    <DialogDescription>
                      Crie um novo usuário para sua clínica. O usuário receberá
                      as credenciais para acessar o sistema.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Nome Completo</Label>
                      <Input
                        id="name"
                        placeholder="João da Silva"
                        value={newUser.displayName}
                        onChange={(e) =>
                          setNewUser({ ...newUser, displayName: e.target.value })
                        }
                        disabled={creating}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="joao@clinica.com"
                        value={newUser.email}
                        onChange={(e) =>
                          setNewUser({ ...newUser, email: e.target.value })
                        }
                        disabled={creating}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">Senha</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={newUser.password}
                        onChange={(e) =>
                          setNewUser({ ...newUser, password: e.target.value })
                        }
                        disabled={creating}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="role">Tipo de Usuário</Label>
                      <Select
                        value={newUser.role}
                        onValueChange={(value: "clinic_admin" | "clinic_user") =>
                          setNewUser({ ...newUser, role: value })
                        }
                        disabled={creating}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clinic_user">
                            Usuário - Acesso básico
                          </SelectItem>
                          <SelectItem value="clinic_admin">
                            Administrador - Acesso completo
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      disabled={creating}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateUser} disabled={creating}>
                      {creating ? "Criando..." : "Criar Usuário"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Limit Warning */}
            {!canAddMoreUsers && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Limite de usuários atingido</AlertTitle>
                <AlertDescription>
                  Sua clínica atingiu o limite de {maxUsers} usuários do plano
                  atual. Para adicionar mais usuários, entre em contato com o
                  suporte.
                </AlertDescription>
              </Alert>
            )}

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
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
                    Limite: {maxUsers} usuários
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
                    {users.filter((u) => u.role === "clinic_admin").length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Com permissões admin
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
                      Todos os usuários cadastrados na clínica
                    </CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou email..."
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
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Cadastro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={user.uid}>
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
      </div>
    </div>
  );
}
