//+------------------------------------------------------------------+
//|                                           Analytica_Ingest.mq5  |
//|                              Analytica — Ingesta Pasiva MT5 v1.1 |
//+------------------------------------------------------------------+
#property copyright "Analytica"
#property version   "1.10"
#property script_show_inputs

input string InpClientID     = "AN-XXXXXXXX";
input string InpClientSecret = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
input string InpIngestURL    = "https://analytica-backend-419965139801.us-central1.run.app/api/v1/ingest/mt5";
input int    InpDaysHistory  = 90;

//+------------------------------------------------------------------+
string EscapeJson(string s)
{
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   StringReplace(s, "\n", "\\n");
   StringReplace(s, "\r", "\\r");
   return s;
}

string CloseReason(long reason)
{
   if(reason == DEAL_REASON_TP)     return "TP";
   if(reason == DEAL_REASON_SL)     return "SL";
   if(reason == DEAL_REASON_CLIENT) return "MANUAL";
   return "UNKNOWN";
}

//+------------------------------------------------------------------+
void OnStart()
{
   datetime end_time   = TimeCurrent();
   datetime start_time = end_time - (InpDaysHistory * 86400);

   if(!HistorySelect(start_time, end_time))
   {
      Print("Analytica ERROR: No se pudo leer el historial.");
      return;
   }

   int total = HistoryDealsTotal();
   string trades_json = "";
   int count = 0;

   // Build a map of position_id -> entry deal ticket
   // We need two passes: first collect all ENTRY_IN deals, then match with ENTRY_OUT

   for(int i = 0; i < total; i++)
   {
      ulong exit_ticket = HistoryDealGetTicket(i);
      if(exit_ticket == 0) continue;

      long entry_type = HistoryDealGetInteger(exit_ticket, DEAL_ENTRY);
      if(entry_type != DEAL_ENTRY_OUT && entry_type != DEAL_ENTRY_INOUT) continue;

      // --- Exit deal data ---
      long   pos_id       = HistoryDealGetInteger(exit_ticket, DEAL_POSITION_ID);
      string symbol       = HistoryDealGetString(exit_ticket,  DEAL_SYMBOL);
      double close_price  = HistoryDealGetDouble(exit_ticket,  DEAL_PRICE);
      double profit_gross = HistoryDealGetDouble(exit_ticket,  DEAL_PROFIT);
      double commission   = HistoryDealGetDouble(exit_ticket,  DEAL_COMMISSION);
      double swap         = HistoryDealGetDouble(exit_ticket,  DEAL_SWAP);
      datetime close_time = (datetime)HistoryDealGetInteger(exit_ticket, DEAL_TIME);
      long   reason       = HistoryDealGetInteger(exit_ticket, DEAL_REASON);
      string comment      = HistoryDealGetString(exit_ticket,  DEAL_COMMENT);
      long   magic        = HistoryDealGetInteger(exit_ticket, DEAL_MAGIC);

      // --- Find matching entry deal by position_id ---
      double   open_price  = close_price;
      datetime open_time   = close_time - 1;
      string   order_type  = "BUY";
      double   sl_price    = 0.0;
      double   tp_price    = 0.0;

      for(int j = 0; j < total; j++)
      {
         ulong entry_ticket = HistoryDealGetTicket(j);
         if(entry_ticket == 0) continue;
         long et = HistoryDealGetInteger(entry_ticket, DEAL_ENTRY);
         if(et != DEAL_ENTRY_IN && et != DEAL_ENTRY_INOUT) continue;
         long ep = HistoryDealGetInteger(entry_ticket, DEAL_POSITION_ID);
         if(ep != pos_id) continue;

         open_price = HistoryDealGetDouble(entry_ticket,  DEAL_PRICE);
         open_time  = (datetime)HistoryDealGetInteger(entry_ticket, DEAL_TIME);
         long dtype = HistoryDealGetInteger(entry_ticket, DEAL_TYPE);
         order_type = (dtype == DEAL_TYPE_BUY) ? "BUY" : "SELL";

         // Try to get SL/TP from the original order
         ulong order_ticket = HistoryDealGetInteger(entry_ticket, DEAL_ORDER);
         if(HistoryOrderSelect(order_ticket))
         {
            sl_price = HistoryOrderGetDouble(order_ticket, ORDER_SL);
            tp_price = HistoryOrderGetDouble(order_ticket, ORDER_TP);
         }
         break;
      }

      if(open_time >= close_time) continue; // Skip inconsistent records

      // --- Build JSON object ---
      string sl_str = (sl_price > 0) ? DoubleToString(sl_price, 5) : "null";
      string tp_str = (tp_price > 0) ? DoubleToString(tp_price, 5) : "null";
      string magic_str = (magic != 0) ? "\"" + (string)magic + "\"" : "null";

      string obj = "{";
      obj += "\"ticket\":\""    + (string)exit_ticket             + "\",";
      obj += "\"symbol\":\""    + EscapeJson(symbol)              + "\",";
      obj += "\"order_type\":\"" + order_type                     + "\",";
      obj += "\"lots\":"        + DoubleToString(HistoryDealGetDouble(exit_ticket, DEAL_VOLUME), 2) + ",";
      obj += "\"open_price\":"  + DoubleToString(open_price, 5)   + ",";
      obj += "\"close_price\":" + DoubleToString(close_price, 5)  + ",";
      obj += "\"open_time\":\"" + TimeToString(open_time,  TIME_DATE|TIME_SECONDS) + "\",";
      obj += "\"close_time\":\"" + TimeToString(close_time, TIME_DATE|TIME_SECONDS) + "\",";
      obj += "\"sl\":"          + sl_str                          + ",";
      obj += "\"tp\":"          + tp_str                          + ",";
      obj += "\"profit_gross\":" + DoubleToString(profit_gross, 2) + ",";
      obj += "\"commission\":"  + DoubleToString(commission, 2)   + ",";
      obj += "\"swap\":"        + DoubleToString(swap, 2)         + ",";
      obj += "\"close_reason\":\"" + CloseReason(reason)          + "\",";
      obj += "\"magic_number\":" + magic_str                      + ",";
      obj += "\"comment\":\""   + EscapeJson(comment)             + "\"";
      obj += "}";

      if(count > 0) trades_json += ",";
      trades_json += obj;
      count++;
   }

   if(count == 0)
   {
      Print("Analytica: Sin trades cerrados en los últimos ", InpDaysHistory, " días.");
      return;
   }

   // --- Send in batches of 100 to avoid payload size limits ---
   Print("Analytica: Enviando ", count, " trades...");

   string full_payload = "{\"account_id\":\"00000000-0000-0000-0000-000000000000\",\"trades\":[" + trades_json + "]}";

   char   post_data[];
   char   response_data[];
   string response_headers;
   string headers = "Content-Type: application/json\r\nX-API-Key: " + InpClientID + ":" + InpClientSecret + "\r\n";

   StringToCharArray(full_payload, post_data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(post_data, ArraySize(post_data) - 1); // Remove null terminator

   ResetLastError();
   int http_code = WebRequest("POST", InpIngestURL, headers, 15000, post_data, response_data, response_headers);

   if(http_code == 200)
   {
      string resp = CharArrayToString(response_data);
      Print("Analytica: Sincronización exitosa. Respuesta: ", resp);
   }
   else
   {
      Print("Analytica ERROR: HTTP ", http_code, " | WinError: ", GetLastError());
      Print("Respuesta: ", CharArrayToString(response_data));
      if(http_code == -1)
         Print(">> Añade la URL del servidor en: Herramientas → Opciones → Asesores Expertos → Permitir WebRequest para URL listadas");
   }
}
//+------------------------------------------------------------------+
