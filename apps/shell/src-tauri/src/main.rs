// Windows release 下不弹控制台
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    house_hub_lib::run()
}
