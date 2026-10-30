# Acreditar saldo Muapi comprado antes de Realizo — usuario piloto

## Contexto
El propietario del proyecto está probando **como usuario normal**. La captura de su cuenta Muapi del 29 de octubre de 2026 muestra **USD 7.75** cargados directamente en Muapi antes de existir las billeteras de Realizo. Este saldo **no es una recarga PayPal** y no debe registrarse en `verified_deposits` ni crearse mediante un pago simulado.

## Regla de conciliación
- Registrar el saldo histórico de **775 centavos USD** una sola vez para el **usuario verificado** que ya inició sesión en Realizo.
- La migración `0003_legacy_muapi_credit.sql` solamente crea la estructura; **no acredita dinero automáticamente**.
- Una nueva importación de saldo histórico para el mismo `user_id` queda bloqueada por `UNIQUE(user_id)`. El movimiento de contabilidad registra `legacy-muapi:<referencia>` para distinguirlo de PayPal.
- Ese saldo es **crédito de servicio en Realizo, respaldado por los fondos prepagados en Muapi**; no se retira dinero de Muapi al importarlo. Cada generación pagada consumirá créditos reales en Muapi y disminuirá el saldo interno de Realizo según su precio configurado.
- No asignar nada a otros usuarios, no activar PayPal Live y no publicar cambios de este piloto en producción.

## Aplicación controlada (requiere acceso autorizado a Cloudflare D1)
1. Confirmar el Worker y el binding `WALLETS_DB` que atienden la web donde inicia sesión el usuario. No suponer que `realizo-wallets` y `realizo-wallets-sandbox` contienen los mismos usuarios. La base de Sandbox se llama `realizo-wallets-sandbox`.
2. Confirmar el **saldo actual** de Muapi por canal autorizado: la documentación oficial describe `GET https://api.muapi.ai/api/v1/account/balance` con `x-api-key`. No imprimir ni compartir la API key. Si el saldo ha cambiado desde la captura, ajustar el importe **solo previa aprobación del propietario**.
3. Aplicar `0003_legacy_muapi_credit.sql` a **esa base** después de `0001_wallet.sql` y `0002_paypal.sql`. En Sandbox, tras revisar la cuenta/Worker correcto, usar `npm run wallet:migrate:sandbox`.
4. Pedir al propietario que inicie sesión normalmente y localizar la fila **exacta** que corresponde a su identidad verificada:
   ```sql
   SELECT id,auth_provider,auth_subject,email,created_at
   FROM wallet_users ORDER BY created_at DESC;
   ```
   Verificar la correspondencia con la sesión real; la dirección de correo puede no ser única, por lo que se debe usar `id`, no acreditar por email sin validación.
5. Verificar que existe `wallets.user_id` y no hay una importación histórica previa. En **la misma D1 verificada** ejecutar UNA VEZ el siguiente SQL, sustituyendo el ID **confirmado**. Un valor de ejemplo sin sustituir no debe acreditar ninguna cuenta.
   ```sql
   INSERT INTO legacy_muapi_credit_imports
     (id,user_id,amount_cents,import_reference,note)
   SELECT 'muapi-pre-realizo-20261029',u.id,775,
     'muapi-prepaid-owner-20261029',
     'Crédito histórico Muapi, pagado por el usuario antes de Realizo; sin PayPal'
   FROM wallet_users AS u
   JOIN wallets AS w ON w.user_id = u.id
   WHERE u.id = 'REEMPLAZAR_CON_ID_VERIFICADO'
     AND u.auth_provider = 'cloudflare-access';
   ```
   Si se acreditaron 0 filas, **NO** atribuir éxito: revisar que el ID/identidad y D1 sean correctos. Si da error de duplicado, consultar `legacy_muapi_credit_imports` y el ledger: nunca repetir con una referencia diferente.
6. Comprobar las dos cifras y el movimiento:
   ```sql
   SELECT w.user_id,w.available_cents,w.reserved_cents
   FROM wallets w WHERE w.user_id='REEMPLAZAR_CON_ID_VERIFICADO';
   SELECT id,user_id,amount_cents,import_reference,created_at
   FROM legacy_muapi_credit_imports
   WHERE user_id='REEMPLAZAR_CON_ID_VERIFICADO';
   SELECT kind,available_delta_cents,external_reference,created_at
   FROM wallet_ledger
   WHERE user_id='REEMPLAZAR_CON_ID_VERIFICADO'
   ORDER BY created_at DESC;
   ```
7. Confirmar en `/wallet` que aparece «Saldo anterior de Muapi». Si existían otros créditos o reservas, el saldo final **no tiene por qué ser exactamente USD 7.75**: debe aumentar precisamente en 775 centavos una sola vez.
8. Antes de gastar Muapi, corregir el `wallet_internal_error` y utilizar un modo piloto de generación real expresamente autorizado, aislado de pagos Live. Verificar modelo/precio/idempotencia y consultar estado para no duplicar cargos.

## Nota importante
Esta importación **no es un pago nuevo** y no satisface el mínimo de la primera recarga real de PayPal (USD 20), cuya regla permanece intacta. La API central de Muapi mantiene un saldo compartido a nivel de proveedor, mientras que D1 contabiliza por separado el derecho de consumo de cada cliente.
