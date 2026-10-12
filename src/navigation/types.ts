export type InicioStackParamList = {
  Tasks: undefined;
  OrderDetail: { orderId: string };
  Notifications: undefined;
};

export type TabParamList = {
  Inicio: undefined;
  Ruta: undefined;
  Perfil: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Evidence: { orderId: string };
  TripCompleted: { orderCode: string; amount?: string | number | null; recipient?: string };
  EditProfile: undefined;
  ChangePassword: undefined;
  ChangeEmail: undefined;
};
