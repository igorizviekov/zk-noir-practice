use merkle::compute_root_from_sibling_path;
use poseidon::poseidon::bn254;

fn main(
    user_value: Field,
    sibling_path: [Field; 4],
    path_indices: [bool; 4],
    merkle_root: pub Field,
) {
    assert(user_value != 0);
    let leaf = bn254::hash_2([user_value, 0]);
    let mut index = 0;
    let mut bit_weight = 1;

    for i in 0..4 {
        if path_indices[i] {
            index += bit_weight;
        }
        bit_weight = bit_weight * 2;
    }

    let computed_root = compute_root_from_sibling_path::<4, poseidon::poseidon::PoseidonHasher>(
        leaf,
        index,
        sibling_path,
    );
    assert(computed_root == merkle_root);
}
