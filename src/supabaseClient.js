import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qgwrhzwddvxplncghfud.supabase.co";
const supabaseKey = "sb_publishable_1u2DuHVv3WkRVgCS_lxpQQ_7HJclz7-";

export const supabase = createClient(supabaseUrl, supabaseKey);