import { getCurrentUser } from "@/lib/auth";
import EmptyState from "@/components/EmptyState";
export default async function AccessPage() {
  const user = await getCurrentUser();
  return (
    <EmptyState
      title={
        user ? "Ожидается подтверждение аккаунта" : "Войдите в командный центр"
      }
      hint={
        user
          ? "Администратор назначит роль после проверки заявки. Данные гильдии пока недоступны."
          : "Используйте кнопку входа в меню. Закрытые данные доступны участникам гильдии."
      }
    />
  );
}
