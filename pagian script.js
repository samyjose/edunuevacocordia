const { useState, useEffect } = React;

// NOTA: Como no estamos en un entorno con `npm`, no podemos usar `import`.
// Los componentes como Card, Button, etc., no estarán disponibles.
// Los he reemplazado con elementos HTML estándar (`div`, `button`, `input`).
// Si quieres usar una librería de componentes, necesitaríamos un sistema de empaquetado como Vite o Create React App.

// --- COMPONENTES SIMPLES REEMPLAZANDO LIBRERÍAS UI ---
const Card = ({ className, children }) => <div className={`bg-white rounded-lg ${className}`}>{children}</div>;
const CardContent = ({ children }) => <div className="p-4">{children}</div>;
const Button = ({ children, ...props }) => <button {...props} className={`w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 ${props.className}`}>{children}</button>;
const Input = (props) => <input {...props} className={`w-full border p-2 rounded ${props.className}`} />;
const Tabs = ({ defaultValue, children }) => {
    const [activeTab, setActiveTab] = useState(defaultValue);
    const tabs = React.Children.toArray(children).filter(c => c.type === TabsList || c.type === TabsContent);
    const list = tabs.find(c => c.type === TabsList);
    const contents = tabs.filter(c => c.type === TabsContent);

    return (
        <div>
            {React.cloneElement(list, { activeTab, setActiveTab })}
            {contents.find(c => c.props.value === activeTab)}
        </div>
    );
};
const TabsList = ({ activeTab, setActiveTab, children }) => (
    <div className="flex border-b mb-4">
        {React.Children.map(children, child => React.cloneElement(child, { activeTab, setActiveTab }))}
    </div>
);
const TabsTrigger = ({ value, activeTab, setActiveTab, children }) => (
    <button
        onClick={() => setActiveTab(value)}
        className={`py-2 px-4 -mb-px border-b-2 ${activeTab === value ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
    >
        {children}
    </button>
);
const TabsContent = ({ children }) => <div>{children}</div>;

// --- API WRAPPER Y UTILITIES ---
const API_URL = 'http://localhost:3000/api';

const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('authToken');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error de red o respuesta no válida' }));
      throw new Error(errorData.error || `Error ${response.status}`);
    }
    // Si la respuesta no tiene contenido (ej. 204 No Content), devuelve un objeto vacío.
    if (response.status === 204) return {};
    return response.json();
  },

  login: (username, password) => api.request('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }),

  googleLogin: (idToken) => api.request('/google-login', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  }),

  verifyToken: () => api.request('/verify-token'),

  getStudents: () => api.request('/students'),

  // NOTA: El backend actual no tiene endpoints para notas, cursos, etc.
  // Usaremos un truco: guardaremos estos datos en el perfil del usuario en localStorage.
  // En una app real, crearíamos endpoints específicos en server.js.
  getData: (user) => JSON.parse(localStorage.getItem(`userData-${user}`)) || {},
  saveData: (user, data) => localStorage.setItem(`userData-${user}`, JSON.stringify(data)),
};

const safeParse = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const save = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e)  {
    console.error('Error al guardar en localStorage:', e);
  }
};

const genId = () => "id-" + Math.random().toString(36).substr(2, 9);
const formatDate = (date) => {
  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return date;
  }
};

// LOGIN SCREEN
function Login({ onLogin }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ user: "", password: "" });

  useEffect(() => {
    // simple real-time validation
    setErrors({
      user: user.trim() === "" ? "Usuario es obligatorio" : "",
      password: password.trim() === "" ? "Contraseña es obligatoria" : "",
    });
  }, [user, password]);

  // Google Sign-In
  useEffect(() => {
    const handleGoogleLogin = async (response) => {
      setLoading(true);
      try {
        const data = await api.googleLogin(response.credential);
        if (data.token) {
          localStorage.setItem('authToken', data.token);
          onLogin(data.user);
        }
      } catch (error) {
        alert(`Error con Google Sign-In: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    google.accounts.id.initialize({
      client_id: "TU-ID-DE-CLIENTE-REAL.apps.googleusercontent.com", // <-- IMPORTANTE: PEGA AQUÍ TU ID DE CLIENTE REAL
      callback: handleGoogleLogin,
    });
    google.accounts.id.renderButton(document.getElementById("google-signin-button"), { theme: "outline", size: "large", width: "100%" });
  }, [onLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // final check
    if (!user.trim() || !password.trim()) {
      setErrors({
        user: user.trim() ? "" : "Usuario es obligatorio",
        password: password.trim() ? "" : "Contraseña es obligatoria",
      });
      return;
    }

    try {
      const data = await api.login(user, password);
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        onLogin(data.user); // Pasamos el nombre de usuario a la app principal
      }
    } catch (error) {
      alert(`Error al iniciar sesión: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 p-4">
      <Card className="shadow-xl p-6 w-full max-w-sm">
        <CardContent>
          <h2 className="text-2xl font-bold text-center mb-4">Iniciar Sesión</h2>

          <form className="grid gap-3" onSubmit={handleSubmit} noValidate>
            <div>
              <Input
                placeholder="Usuario"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                aria-label="usuario"
                required
              />
              {errors.user && <p className="text-xs text-red-600 mt-1">{errors.user}</p>}
            </div>

            <div>
              <Input
                placeholder="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="contraseña"
                required
              />
              {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
            </div>

            <Button type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">O</span></div>
            </div>
            <div id="google-signin-button"></div>

            <a href="#" className="text-sm text-blue-600 hover:underline block text-center mb-2">¿Olvidaste tu contraseña?</a>
            <p className="text-xs text-gray-500 text-center">* Validaciones: Usuario y contraseña obligatorios</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// --- COMPONENTE PARA GESTIONAR ESTUDIANTES (CRUD) ---
function EstudiantesTab({ estudiantes, onAdd, onUpdate, onDelete }) {
  const [editando, setEditando] = useState(null); // Guarda el estudiante que se está editando
  const [filtro, setFiltro] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const studentData = {
      name: form.get("name"),
      id: form.get("studentId"), // ID de matrícula
      level: form.get("level"),
      email: form.get("email"),
    };

    if (!studentData.name || !studentData.level) {
      alert("El nombre y el curso son obligatorios.");
      return;
    }

    try {
      if (editando) {
        // Actualizar estudiante existente
        await onUpdate(editando.sid, { ...editando, ...studentData });
      } else {
        // Añadir nuevo estudiante
        const newStudent = { ...studentData, sid: genId() }; // sid es el ID interno único
        await onAdd(newStudent);
      }
      setEditando(null); // Limpiar formulario
      e.target.reset();
    } catch (error) {
      alert(`Error al guardar el estudiante: ${error.message}`);
    }
  };

  const handleEdit = (student) => {
    setEditando(student);
    // Scroll hacia el formulario para mejor UX
    document.getElementById('student-form').scrollIntoView({ behavior: 'smooth' });
  };

  const handleDelete = async (sid) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este estudiante? Esta acción no se puede deshacer.")) {
      try {
        await onDelete(sid);
      } catch (error) {
        alert(`Error al eliminar: ${error.message}`);
      }
    }
  };

  const cancelarEdicion = () => {
    setEditando(null);
    document.getElementById('student-form').reset();
  };

  const estudiantesFiltrados = estudiantes.filter(s => 
    s.name.toLowerCase().includes(filtro.toLowerCase()) || 
    s.level.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <Card className="p-4 shadow-md">
      <h3 className="text-lg font-semibold mb-4">{editando ? `Editando a ${editando.name}` : 'Añadir Nuevo Estudiante'}</h3>
      <form id="student-form" className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 border-b pb-8" onSubmit={handleSubmit}>
        <Input name="name" placeholder="Nombre completo" required defaultValue={editando?.name} />
        <Input name="studentId" placeholder="ID de estudiante (opcional)" defaultValue={editando?.id} />
        <Input name="email" type="email" placeholder="Email (opcional)" defaultValue={editando?.email} />
        <Input name="level" placeholder="Curso (ej: 1ro BGU)" required defaultValue={editando?.level} />
        <div className="flex gap-2">
          <Button type="submit" className="flex-grow">{editando ? 'Actualizar' : 'Añadir'}</Button>
          {editando && <Button type="button" className="bg-gray-500 hover:bg-gray-600 flex-grow" onClick={cancelarEdicion}>Cancelar</Button>}
        </div>
      </form>

      <h3 className="text-lg font-semibold mb-2">Lista de Estudiantes</h3>
      <Input 
        placeholder="Buscar por nombre o curso..." 
        value={filtro} 
        onChange={e => setFiltro(e.target.value)}
        className="mb-4"
      />

      <ul className="grid gap-2">
        {estudiantesFiltrados.map(s => (
          <li key={s.sid} className="p-3 bg-gray-50 rounded shadow-sm flex justify-between items-center">
            <div>
              <p className="font-bold">{s.name}</p>
              <p className="text-sm text-gray-600">
                {s.level} {s.id && `(ID: ${s.id})`}
                {s.email && <span className="ml-2 text-blue-500">{s.email}</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleEdit(s)} className="w-auto px-3 py-1 text-xs">Editar</Button>
              <Button onClick={() => handleDelete(s.sid)} className="w-auto px-3 py-1 text-xs bg-red-600 hover:bg-red-700">Eliminar</Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// MAIN APP WITH ATTENDANCE
function SistemaAsistenciaConcordia() {  
  const [currentUser, setCurrentUser] = useState(null);
  // Usamos los datos de ejemplo para los estudiantes
  const [estudiantes, setEstudiantes] = useState([]);
  const [registro, setRegistro] = useState([]);
  const [notas, setNotas] = useState([]);
  const [cursoSeleccionado, setCursoSeleccionado] = useState(null);
  const [notaEditando, setNotaEditando] = useState(null); // Nuevo estado para la edición de notas
  const [filtroNotas, setFiltroNotas] = useState(""); // Nuevo estado para el filtro de búsqueda
  const [loading, setLoading] = useState(true); // Estado para la carga inicial
  
  const [cursos, setCursos] = useState([]);
  const [paralelos, setParalelos] = useState([]);

  // Al cargar la app, verifica si hay un token válido
  useEffect(() => {
    const checkLogin = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const data = await api.verifyToken();
          setCurrentUser(data.user);
        } catch (error) {
          localStorage.removeItem('authToken'); // Token inválido
        }
      }
      setLoading(false);
    };
    checkLogin();
  }, []);

  // Cargar datos cuando el usuario inicia sesión
  useEffect(() => {
    if (currentUser) {
      const data = api.getData(currentUser);
      
      api.getStudents().then(students => {
        setEstudiantes(students);
        const studentCourses = [...new Set(students.map(s => s.level))].sort();
        // Los paralelos ahora se obtienen de los estudiantes, no de localStorage
        setCursos(studentCourses);
      }).catch(err => {
        console.error("Error fetching students", err);
        alert("No se pudieron cargar los estudiantes. " + err.message);
      });

      // Cargar notas y registro desde localStorage
      setNotas(data.notas || []);
      setRegistro(data.registro || []);
    }
  }, [currentUser]);

  // Guardar datos en el backend (simulado con localStorage por usuario)
  const persistData = (newData) => {
    if (!currentUser) return;
    const currentData = api.getData(currentUser);
    api.saveData(currentUser, { ...currentData, ...newData });
  };

  // --- MANEJADORES DE ESTUDIANTES ---
  const handleAñadirEstudiante = async (nuevoEstudiante) => {
    await api.addStudent(nuevoEstudiante);
    const estudiantesActualizados = [...estudiantes, nuevoEstudiante];
    setEstudiantes(estudiantesActualizados);
    // Actualizar lista de cursos si es uno nuevo
    const studentCourses = [...new Set(estudiantesActualizados.map(s => s.level))].sort();
    setCursos(studentCourses);
  };

  const handleActualizarEstudiante = async (sid, datosActualizados) => {
    await api.updateStudent(sid, datosActualizados);
    const estudiantesActualizados = estudiantes.map(s => s.sid === sid ? datosActualizados : s);
    setEstudiantes(estudiantesActualizados);
    // Actualizar lista de cursos por si cambió
    const studentCourses = [...new Set(estudiantesActualizados.map(s => s.level))].sort();
    setCursos(studentCourses);
  };

  const handleEliminarEstudiante = async (sid) => {
    await api.deleteStudent(sid);
    const estudiantesActualizados = estudiantes.filter(s => s.sid !== sid);
    setEstudiantes(estudiantesActualizados);
    // Actualizar lista de cursos por si se eliminó el último de un curso
    const studentCourses = [...new Set(estudiantesActualizados.map(s => s.level))].sort();
    setCursos(studentCourses);

    // Opcional: Limpiar registros de asistencia y notas del estudiante eliminado
    const nombreEstudianteEliminado = estudiantes.find(s => s.sid === sid)?.name;
    if (nombreEstudianteEliminado) {
      const registroActualizado = registro.filter(r => r.nombre !== nombreEstudianteEliminado);
      const notasActualizadas = notas.filter(n => n.nombre !== nombreEstudianteEliminado);
      setRegistro(registroActualizado);
      setNotas(notasActualizadas);
      persistData({ registro: registroActualizado, notas: notasActualizadas });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setCurrentUser(null);
  };

  // Función para eliminar una nota
  const eliminarNota = (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
      const notasActualizadas = notas.filter(n => n.id !== id);
      setNotas(notasActualizadas);
      persistData({ notas: notasActualizadas });
    }
  };

  // Función para añadir un nuevo curso
  const anadirCurso = () => {
    const nuevoCurso = window.prompt("Introduce el nombre del nuevo curso:");
    if (nuevoCurso && nuevoCurso.trim() !== "") {
      const cursoLimpio = nuevoCurso.trim();
      if (!cursos.find(c => c.toLowerCase() === cursoLimpio.toLowerCase())) {
        const cursosActualizados = [...cursos, cursoLimpio].sort();
        setCursos(cursosActualizados);
        persistData({ cursos: cursosActualizados });
      } else {
        alert("Ese curso ya existe.");
      }
    }
  }

  // Filtra los estudiantes que pertenecen al curso seleccionado
  const estudiantesDelCurso = estudiantes.filter(e => e.level === cursoSeleccionado);

  // Función para registrar la asistencia de un estudiante específico
  const registrarAsistenciaEstudiante = (estudiante, presente) => {
    const hoy = new Date().toISOString().split('T')[0]; // Fecha en formato YYYY-MM-DD

    const nuevoRegistro = { // Usar 'name' del estudiante
      id: genId(),
      nombre: estudiante.name,
      materia: 'General', // Puedes ajustar esto si es necesario
      fecha: hoy,
      asistencia: presente,
    };

    // Evita duplicados: si ya hay un registro para este estudiante hoy, lo reemplaza.
    const otrosRegistros = registro.filter(
      r => !(r.nombre === estudiante.name && r.fecha === hoy) // Usar 'name'
    );

    const updated = [...otrosRegistros, nuevoRegistro];
    setRegistro(updated);
    persistData({ registro: updated });
  };

  // Devuelve el estado de asistencia de un estudiante para hoy
  const getAsistenciaHoy = (estudiante) => {
    const hoy = new Date().toISOString().split('T')[0];
    const registroHoy = registro.find(r => r.nombre === estudiante.name && r.fecha === hoy); // Usar 'name'
    return registroHoy ? registroHoy.asistencia : null; // null si no hay registro
  };

  const contar = (estado) => registro.filter((r) => r.asistencia === estado).length;

  if (loading) return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  if (!currentUser) return <Login onLogin={(user) => setCurrentUser(user)} />;

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-4 text-center">
        Sistema de Asistencia - UE La Concordia ({currentUser})
      </h1>

      <div className="flex justify-between items-center mb-4">
        <div />
        <div className="flex items-center gap-2">
          <Button className="bg-red-600" onClick={handleLogout}>Cerrar Sesión</Button>
        </div>
      </div>

      <Tabs defaultValue="formulario">
        <TabsList>
          <TabsTrigger value="formulario">Registrar Asistencia</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="estudiantes">Estudiantes</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="estadisticas">Estadísticas</TabsTrigger>
        </TabsList>

        {/* FORMULARIO */}
        <TabsContent value="formulario">
          {!cursoSeleccionado ? (
            // 1. Mostrar lista de cursos
            <Card className="p-4 shadow-md">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">Selecciona un curso</h3>
                <Button type="button" onClick={anadirCurso} className="w-auto px-4 text-sm">
                  Añadir Curso
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {cursos.map(curso => (
                  <Button key={curso} onClick={() => setCursoSeleccionado(curso)} className="h-24 text-lg">
                    {curso}
                  </Button>
                ))}
              </div>
            </Card>
          ) : (
            // 2. Mostrar estudiantes del curso seleccionado
            <Card className="p-4 shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Asistencia para: {cursoSeleccionado}</h3>
                <Button onClick={() => setCursoSeleccionado(null)} className="w-auto px-4 py-1 text-sm">
                  &larr; Volver a Cursos
                </Button>
              </div>
              <ul className="grid gap-3">
                {estudiantesDelCurso.map(estudiante => {
                  const asistenciaHoy = getAsistenciaHoy(estudiante);
                  return (
                    <li key={estudiante.sid} className="p-3 bg-gray-50 rounded shadow-sm flex justify-between items-center"> {/* Usar sid como key */}
                      <span className="font-medium">{estudiante.name}</span> {/* Usar name */}
                      <div className="flex gap-2">
                        <Button onClick={() => registrarAsistenciaEstudiante(estudiante, true)} className={`w-auto px-4 py-1 text-sm ${asistenciaHoy === true ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 hover:bg-green-500'}`}>
                          Presente
                        </Button>
                        <Button onClick={() => registrarAsistenciaEstudiante(estudiante, false)} className={`w-auto px-4 py-1 text-sm ${asistenciaHoy === false ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-400 hover:bg-red-500'}`}>
                          Ausente
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </TabsContent>

        {/* ESTUDIANTES */}
        <TabsContent value="estudiantes">
          <Card className="p-4 shadow-md">
            <EstudiantesTab 
              estudiantes={estudiantes}
              onAdd={handleAñadirEstudiante}
              onUpdate={handleActualizarEstudiante}
              onDelete={handleEliminarEstudiante}
            />
          </Card>
        </TabsContent>

        {/* NOTAS */}
        <TabsContent value="notas">
          <Card className="p-4 shadow-md">
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.target);
                const nombre = form.get("nombre")?.toString();
                const curso = form.get("curso")?.toString();
                const p1 = parseFloat(form.get("parcial1"));
                const p2 = parseFloat(form.get("parcial2"));
                const p3 = parseFloat(form.get("parcial3"));
                const ex = parseFloat(form.get("examenFinal")) || 0;
                const sup = parseFloat(form.get("supletorio")) || null; // Supletorio es opcional

                // El supletorio reemplaza al examen final en el cálculo si existe
                const examenParaPromedio = sup !== null ? sup : ex;
                const promedio = ((p1 + p2 + p3 + examenParaPromedio) / 4).toFixed(2);

                let actual;
                if (notaEditando) {
                  // Estamos editando una nota existente
                  actual = notas.map(n => 
                    n.id === notaEditando.id ? { ...notaEditando, nombre, curso, p1, p2, p3, ex, sup, promedio } : n
                  );
                  setNotaEditando(null); // Salir del modo edición
                } else {
                  // Creando una nota nueva
                  const notaNueva = { id: genId(), nombre, curso, p1, p2, p3, ex, sup, promedio };
                  actual = [...notas, notaNueva];
                }

                setNotas(actual);
                persistData({ notas: actual });
                e.target.reset();
              }}
            >
              <h3 className="text-lg font-semibold">{notaEditando ? `Editando a: ${notaEditando.nombre}` : 'Registrar Nueva Nota'}</h3>
              <Input name="nombre" placeholder="Nombre del estudiante" required defaultValue={notaEditando?.nombre} />
              <div className="flex items-center gap-2">
                <select name="curso" className="border p-2 rounded w-full" required defaultValue={notaEditando?.curso}>
                  <option value="">Curso</option>
                  {cursos.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Button type="button" onClick={anadirCurso} className="w-auto px-4 text-sm">
                  +
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input name="parcial1" placeholder="Parcial 1" type="number" step="0.01" required defaultValue={notaEditando?.p1} />
                <Input name="parcial2" placeholder="Parcial 2" type="number" step="0.01" required defaultValue={notaEditando?.p2} />
                <Input name="parcial3" placeholder="Parcial 3" type="number" step="0.01" required defaultValue={notaEditando?.p3} />
                <Input name="examenFinal" placeholder="Examen Final" type="number" step="0.01" required defaultValue={notaEditando?.ex} />
              </div>
              <Input name="supletorio" placeholder="Examen de Supletorio (opcional)" type="number" step="0.01" defaultValue={notaEditando?.sup} />
              <div className="flex gap-2">
                <Button type="submit">{notaEditando ? 'Actualizar Nota' : 'Guardar Nota'}</Button>
                {notaEditando && (
                  <Button onClick={() => { setNotaEditando(null); document.querySelector('form').reset(); }} className="bg-gray-500 hover:bg-gray-600">
                    Cancelar
                  </Button>
                )}
              </div>
            </form>

            {/* LISTA DE NOTAS */}
            <div className="border-t mt-6 pt-4">
              <h3 className="text-lg font-semibold mb-2">Lista de Notas Guardadas</h3>
              <Input
                placeholder="Buscar por nombre de estudiante..."
                value={filtroNotas}
                onChange={(e) => setFiltroNotas(e.target.value)}
                className="mb-4"
              />
            </div>
            <ul className="grid gap-2 mt-4">
              {notas.filter(n => n.nombre.toLowerCase().includes(filtroNotas.toLowerCase())).map((n) => (
                <li key={n.id} className="p-3 bg-white rounded shadow-sm">
                  <div className="flex justify-between items-start">
                    <span><b>{n.nombre}</b> - {n.curso}</span>
                    <div className="flex gap-2">
                      <Button onClick={() => setNotaEditando(n)} className="ml-2 py-0 px-2 text-xs w-auto">Editar</Button>
                      <Button onClick={() => eliminarNota(n.id)} className="py-0 px-2 text-xs w-auto bg-red-600 hover:bg-red-700">Eliminar</Button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">
                    P1: {n.p1} | P2: {n.p2} | P3: {n.p3} | Ex: {n.ex} {n.sup && `| Sup: ${n.sup}`} → <b>Promedio: </b>
                    <b className={parseFloat(n.promedio) < 7 ? 'text-red-600' : 'text-green-600'}>
                      {n.promedio}
                    </b>
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>

        {/* LISTA */}
        <TabsContent value="lista">
          <Card className="p-4 shadow-md">
            <ul className="grid gap-2">
              {registro.map((r) => (
                <li
                  key={r.id}
                  className="p-3 rounded bg-white shadow-sm flex justify-between"
                >
                  <span>
                    <b>{r.nombre}</b> - {r.materia} - {formatDate(r.fecha)}
                  </span>
                  <span
                    className={
                      r.asistencia ? "text-green-600 font-semibold" : "text-red-600 font-semibold"
                    }
                  >
                    {r.asistencia ? "Presente" : "Ausente"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>

        {/* ESTADISTICAS */}
        <TabsContent value="estadisticas">
          <div className="grid grid-cols-2 gap-4 mt-4">
            <StatCard label="Presentes" value={contar(true)} />
            <StatCard label="Ausentes" value={contar(false)} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div
      className="bg-white p-6 text-center rounded-xl shadow-lg"
    >
      <h3 className="text-xl font-semibold">{label}</h3>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}

// --- PUNTO DE ENTRADA DE LA APLICACIÓN ---
// Busca el div con id "root" y renderiza el componente principal de React.
const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<SistemaAsistenciaConcordia />);